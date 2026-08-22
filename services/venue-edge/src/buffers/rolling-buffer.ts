import { randomUUID } from "node:crypto"
import { mkdir, readdir, stat } from "node:fs/promises"
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
}

export class RollingBufferSupervisor {
  private running = false
  private segmentTimer: NodeJS.Timeout | null = null

  constructor(
    private readonly camera: CameraSourceConfig,
    private readonly paths: LocalStoragePaths,
    private readonly repositories: EdgeRepositories,
    private readonly options: RollingBufferOptions = {},
  ) {}

  isRunning(): boolean {
    return this.running
  }

  async start(): Promise<void> {
    if (this.running) {
      return
    }

    this.running = true

    if (this.options.simulate || !this.camera.rtspUrl) {
      this.startSimulatedSegments()
      return
    }

    const outputDir = this.paths.bufferForCamera(this.camera.cameraId)
    await mkdir(outputDir, { recursive: true })

    const segmentSeconds = this.options.segmentSeconds ?? 4
    const pattern = join(outputDir, "segment-%09d.ts")

    safeLog("info", "Starting FFmpeg rolling buffer", {
      cameraId: this.camera.cameraId,
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
    }).then((result) => {
      safeLog("error", "FFmpeg rolling buffer exited", {
        exitCode: result.exitCode,
        stderr: result.stderr.slice(-800),
      })
      this.running = false
    }).catch((error) => {
      safeLog("error", "FFmpeg rolling buffer exited", {
        message: error instanceof Error ? error.message : String(error),
      })
      this.running = false
    })

    this.startLiveSegmentIndexer(outputDir, segmentSeconds)
  }

  async stop(): Promise<void> {
    this.running = false

    if (this.segmentTimer) {
      clearInterval(this.segmentTimer)
      this.segmentTimer = null
    }
  }

  private startLiveSegmentIndexer(
    outputDir: string,
    segmentSeconds: number,
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
        indexed,
      )
    }, 2_000)
  }

  private async indexLiveSegments(
    outputDir: string,
    segmentSeconds: number,
    retentionSeconds: number,
    indexed: Set<string>,
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

    const cutoff = new Date(Date.now() - retentionSeconds * 1000)
    const segments = this.repositories.listBufferSegmentsForWindow(
      this.camera.cameraId,
      cutoff.toISOString(),
      new Date().toISOString(),
    )

    if (segments.length > 0) {
      safeLog("info", "Live buffer segments indexed", {
        cameraId: this.camera.cameraId,
        segmentCount: segments.length,
      })
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

      const endedAt = new Date()
      const startedAt = new Date(
        endedAt.getTime() - segmentSeconds * 1000,
      )
      const id = randomUUID()
      const path = join(
        this.paths.bufferForCamera(this.camera.cameraId),
        `segment-${String(sequence).padStart(9, "0")}.mp4`,
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
        endedAt.toISOString(),
      )

      safeLog("info", "Simulated buffer segment recorded", {
        cameraId: this.camera.cameraId,
        segmentCount: segments.length,
      })
    }, segmentSeconds * 1000)
  }
}
