import { randomUUID } from "node:crypto"
import { mkdir, readdir, stat, unlink } from "node:fs/promises"
import { join } from "node:path"

import type { CameraSourceConfig } from "../cameras/source"
import { runFfmpeg } from "../ffmpeg/runner"
import { safeLog } from "../health/metrics"
import type { EdgeRepositories } from "../local-storage/repositories"
import type { LocalStoragePaths } from "../local-storage/paths"

export interface RollingBufferOptions {
  segmentSeconds?: number
  retentionSeconds?: number
  simulate?: boolean
  maxDiskBytes?: number
  clockOffsetSeconds?: number
  onFfmpegExited?: (sourceId: string) => void
}

export class RollingBufferSupervisor {
  private running = false
  private segmentTimer: NodeJS.Timeout | null = null
  private ffmpegAbortController: AbortController | null = null

  constructor(
    private readonly camera: CameraSourceConfig,
    private readonly paths: LocalStoragePaths,
    private readonly repositories: EdgeRepositories,
    private readonly options: RollingBufferOptions = {}
  ) {}

  isRunning(): boolean {
    return this.running
  }

  getCameraId(): string {
    return this.camera.cameraId
  }

  getSourceId(): string {
    return this.camera.cameraId
  }

  async start(): Promise<void> {
    if (this.running) {
      return
    }

    const logContext = {
      sourceId: this.camera.cameraId,
      resourceId: this.camera.resourceId ?? null,
    }

    if (!this.options.simulate && !this.camera.rtspUrl) {
      throw new Error(`SOURCE_RTSP_URL_MISSING:${this.camera.cameraId}`)
    }

    this.running = true
    this.ffmpegAbortController = new AbortController()

    if (this.options.simulate) {
      safeLog("info", "Starting simulated rolling buffer", logContext)
      this.startSimulatedSegments()
      return
    }

    const outputDir = this.paths.bufferForCamera(this.camera.cameraId)
    await mkdir(outputDir, { recursive: true })

    const segmentSeconds = this.options.segmentSeconds ?? 4
    const pattern = join(outputDir, "segment-%09d.ts")

    safeLog("info", "Starting FFmpeg rolling buffer", {
      ...logContext,
      segmentSeconds,
    })

    void runFfmpeg({
      args: [
        "-rtsp_transport",
        "tcp",
        "-i",
        this.camera.rtspUrl!,
        "-c",
        "copy",
        "-f",
        "segment",
        "-segment_format",
        "mpegts",
        "-segment_time",
        String(segmentSeconds),
        pattern,
      ],
      logLevel: "warning",
      signal: this.ffmpegAbortController.signal,
    })
      .then((result) => {
        if (result.cancelled) {
          safeLog("info", "FFmpeg rolling buffer cancelled", logContext)
        } else {
          safeLog("error", "FFmpeg rolling buffer exited", {
            ...logContext,
            exitCode: result.exitCode,
            stderr: result.stderr.slice(-800),
          })
          this.options.onFfmpegExited?.(this.camera.cameraId)
        }
        this.running = false
      })
      .catch((error) => {
        safeLog("error", "FFmpeg rolling buffer exited", {
          ...logContext,
          message: error instanceof Error ? error.message : String(error),
        })
        this.options.onFfmpegExited?.(this.camera.cameraId)
        this.running = false
      })

    this.startLiveSegmentIndexer(outputDir, segmentSeconds)
  }

  async stop(): Promise<void> {
    this.running = false

    if (this.ffmpegAbortController) {
      this.ffmpegAbortController.abort()
      this.ffmpegAbortController = null
    }

    if (this.segmentTimer) {
      clearInterval(this.segmentTimer)
      this.segmentTimer = null
    }
  }

  private startLiveSegmentIndexer(
    outputDir: string,
    segmentSeconds: number
  ): void {
    const retentionSeconds = this.options.retentionSeconds ?? 120
    const indexed = new Set<string>()

    this.segmentTimer = setInterval(() => {
      if (!this.running) {
        return
      }

      void this.indexLiveSegments(
        outputDir,
        segmentSeconds,
        retentionSeconds,
        indexed
      )
    }, 2_000)
  }

  private async indexLiveSegments(
    outputDir: string,
    segmentSeconds: number,
    retentionSeconds: number,
    indexed: Set<string>
  ): Promise<void> {
    let files: string[] = []

    try {
      files = await readdir(outputDir)
    } catch {
      return
    }

    for (const file of files) {
      if (!file.endsWith(".ts") || indexed.has(file)) {
        continue
      }

      const path = join(outputDir, file)

      try {
        const fileStat = await stat(path)
        if (fileStat.size < 1_000) {
          continue
        }

        const endedAt = new Date(fileStat.mtimeMs)
        const startedAt = new Date(endedAt.getTime() - segmentSeconds * 1000)

        this.repositories.recordBufferSegment({
          id: `${this.camera.cameraId}-${file}`,
          cameraId: this.camera.cameraId,
          path,
          startedAt: startedAt.toISOString(),
          endedAt: endedAt.toISOString(),
          durationSeconds: segmentSeconds,
        })
        indexed.add(file)
      } catch {
        // File may still be growing.
      }
    }

    await this.enforceDiskBudget(outputDir)

    const cutoff = new Date(Date.now() - retentionSeconds * 1000)
    const segments = this.repositories.listBufferSegmentsForWindow(
      this.camera.cameraId,
      cutoff.toISOString(),
      new Date().toISOString()
    )

    if (segments.length > 0) {
      safeLog("info", "Live buffer segments indexed", {
        sourceId: this.camera.cameraId,
        resourceId: this.camera.resourceId ?? null,
        segmentCount: segments.length,
      })
    }
  }

  private async enforceDiskBudget(outputDir: string): Promise<void> {
    const maxDiskBytes = this.options.maxDiskBytes
    if (!maxDiskBytes || maxDiskBytes <= 0) {
      return
    }

    let files: string[] = []

    try {
      files = await readdir(outputDir)
    } catch {
      return
    }

    const segmentFiles = files.filter((file) => file.endsWith(".ts"))
    const sized = await Promise.all(
      segmentFiles.map(async (file) => {
        const path = join(outputDir, file)
        const fileStat = await stat(path)
        return { file, path, size: fileStat.size, mtimeMs: fileStat.mtimeMs }
      })
    )

    let totalBytes = sized.reduce((sum, entry) => sum + entry.size, 0)
    if (totalBytes <= maxDiskBytes) {
      return
    }

    sized.sort((left, right) => left.mtimeMs - right.mtimeMs)

    for (const entry of sized) {
      if (totalBytes <= maxDiskBytes) {
        break
      }

      try {
        await unlink(entry.path)
        totalBytes -= entry.size
      } catch {
        // Segment may still be open.
      }
    }
  }

  private startSimulatedSegments(): void {
    const segmentSeconds = this.options.segmentSeconds ?? 4
    const retentionSeconds = this.options.retentionSeconds ?? 120
    let sequence = 0

    this.segmentTimer = setInterval(() => {
      if (!this.running) {
        return
      }

      const offsetMs = (this.options.clockOffsetSeconds ?? 0) * 1000
      const endedAt = new Date(Date.now() + offsetMs)
      const startedAt = new Date(endedAt.getTime() - segmentSeconds * 1000)
      const id = randomUUID()
      const path = join(
        this.paths.bufferForCamera(this.camera.cameraId),
        `segment-${String(sequence).padStart(9, "0")}.mp4`
      )

      this.repositories.recordBufferSegment({
        id,
        cameraId: this.camera.cameraId,
        path,
        startedAt: startedAt.toISOString(),
        endedAt: endedAt.toISOString(),
        durationSeconds: segmentSeconds,
      })

      sequence += 1

      const cutoff = new Date(Date.now() - retentionSeconds * 1000)
      const segments = this.repositories.listBufferSegmentsForWindow(
        this.camera.cameraId,
        cutoff.toISOString(),
        endedAt.toISOString()
      )

      safeLog("info", "Simulated buffer segment recorded", {
        sourceId: this.camera.cameraId,
        resourceId: this.camera.resourceId ?? null,
        segmentCount: segments.length,
      })
    }, segmentSeconds * 1000)
  }
}
