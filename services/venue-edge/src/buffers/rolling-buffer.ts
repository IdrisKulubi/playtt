import { randomUUID } from "node:crypto"
import { mkdir, readdir, stat, unlink } from "node:fs/promises"
import { join } from "node:path"

import type { CameraSourceConfig } from "../cameras/source"
import { runFfmpeg } from "../ffmpeg/runner"
import { safeLog } from "../health/metrics"
import type { EdgeRepositories } from "../local-storage/repositories"
import type { LocalStoragePaths } from "../local-storage/paths"

/**
 * RTSP socket timeout. ffmpeg's default is to wait forever, so a recorder
 * that is switched off left a process "running" with no video for hours.
 * With this, ffmpeg exits and the registry restarts it.
 */
export const RTSP_SOCKET_TIMEOUT_US = 15_000_000

/**
 * Segment length. A replay can only be cut once the segment holding its last
 * second has closed, so shorter segments mean the TV waits less after the
 * post-roll. (With stream copy, cuts land on keyframes: a camera with a
 * longer keyframe interval simply produces longer segments.)
 */
export const DEFAULT_SEGMENT_SECONDS = 2
/**
 * How often closed segments are indexed. Also latency on every replay (a
 * readdir every 250 ms is cheap next to that).
 */
export const LIVE_INDEX_INTERVAL_MS = 250
/** Disk budget checks stat every segment, so they run less often. */
const DISK_BUDGET_INTERVAL_MS = 5_000

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
  /** Last time this buffer started or saved a segment (ms). */
  private lastProgressAt = 0
  private lastDiskBudgetAt = 0
  private indexing = false

  constructor(
    private readonly camera: CameraSourceConfig,
    private readonly paths: LocalStoragePaths,
    private readonly repositories: EdgeRepositories,
    private readonly options: RollingBufferOptions = {}
  ) {}

  isRunning(): boolean {
    return this.running
  }

  /** Running, but no segment saved for longer than `stallMs`. */
  isStalled(now: number, stallMs: number): boolean {
    return this.running && now - this.lastProgressAt > stallMs
  }

  getLastProgressAt(): number {
    return this.lastProgressAt
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
    this.lastProgressAt = Date.now()
    this.ffmpegAbortController = new AbortController()

    if (this.options.simulate) {
      safeLog("info", "Starting simulated rolling buffer", logContext)
      this.startSimulatedSegments()
      return
    }

    const outputDir = this.paths.bufferForCamera(this.camera.cameraId)
    await mkdir(outputDir, { recursive: true })

    const segmentSeconds = this.options.segmentSeconds ?? DEFAULT_SEGMENT_SECONDS
    const existingFiles = await readdir(outputDir)
    const nextSegmentNumber =
      existingFiles.reduce((highest, file) => {
        const match = file.match(/^segment-(\d+)\.ts$/)
        return match ? Math.max(highest, Number(match[1])) : highest
      }, -1) + 1
    const pattern = join(outputDir, "segment-%09d.ts")

    safeLog("info", "Starting FFmpeg rolling buffer", {
      ...logContext,
      segmentSeconds,
      nextSegmentNumber,
    })

    void runFfmpeg({
      args: [
        "-rtsp_transport",
        "tcp",
        "-timeout",
        String(RTSP_SOCKET_TIMEOUT_US),
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
        "-segment_start_number",
        String(nextSegmentNumber),
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
      // Skip a tick rather than overlap a slow directory scan.
      if (!this.running || this.indexing) {
        return
      }

      this.indexing = true
      void this.indexLiveSegments(
        outputDir,
        segmentSeconds,
        retentionSeconds,
        indexed
      )
        .catch((error) => {
          safeLog("warn", "Live buffer indexing failed", {
            sourceId: this.camera.cameraId,
            message: error instanceof Error ? error.message : String(error),
          })
        })
        .finally(() => {
          this.indexing = false
        })
    }, LIVE_INDEX_INTERVAL_MS)
  }

  private async indexLiveSegments(
    outputDir: string,
    segmentSeconds: number,
    retentionSeconds: number,
    indexed: Set<string>
  ): Promise<void> {
    let files: string[] = []
    let newlyIndexed = 0

    try {
      files = await readdir(outputDir)
    } catch {
      return
    }

    const closedSegmentFiles = files
      .filter((file) => file.endsWith(".ts"))
      .sort()
      .slice(0, -1)

    for (const file of closedSegmentFiles) {
      if (indexed.has(file)) {
        continue
      }

      const path = join(outputDir, file)

      try {
        const fileStat = await stat(path)
        if (fileStat.size < 1_000) {
          continue
        }

        const endedAtMs = fileStat.mtimeMs
        const birthtimeLooksUsable =
          Number.isFinite(fileStat.birthtimeMs) &&
          fileStat.birthtimeMs > 0 &&
          fileStat.birthtimeMs < endedAtMs - 250
        const startedAtMs = birthtimeLooksUsable
          ? fileStat.birthtimeMs
          : endedAtMs - segmentSeconds * 1000
        const endedAt = new Date(endedAtMs)
        const startedAt = new Date(startedAtMs)
        const measuredDurationSeconds = Math.max(
          0.1,
          (endedAtMs - startedAtMs) / 1000,
        )

        this.repositories.recordBufferSegment({
          id: `${this.camera.cameraId}-${file}`,
          cameraId: this.camera.cameraId,
          path,
          startedAt: startedAt.toISOString(),
          endedAt: endedAt.toISOString(),
          durationSeconds: measuredDurationSeconds,
        })
        indexed.add(file)
        newlyIndexed += 1
      } catch {
        // File may still be growing.
      }
    }

    if (Date.now() - this.lastDiskBudgetAt >= DISK_BUDGET_INTERVAL_MS) {
      this.lastDiskBudgetAt = Date.now()
      await this.enforceDiskBudget(outputDir)
    }

    if (newlyIndexed > 0) {
      const cutoff = new Date(Date.now() - retentionSeconds * 1000)
      const segments = this.repositories.listBufferSegmentsForWindow(
        this.camera.cameraId,
        cutoff.toISOString(),
        new Date().toISOString()
      )
      this.lastProgressAt = Date.now()
      safeLog("debug", "Live buffer segments indexed", {
        sourceId: this.camera.cameraId,
        resourceId: this.camera.resourceId ?? null,
        newlyIndexed,
        activeSegmentCount: segments.length,
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
    const sized = (
      await Promise.all(
        segmentFiles.map(async (file) => {
          const path = join(outputDir, file)
          try {
            const fileStat = await stat(path)
            return { file, path, size: fileStat.size, mtimeMs: fileStat.mtimeMs }
          } catch {
            // Deleted between readdir and stat: nothing to budget.
            return null
          }
        })
      )
    ).filter((entry): entry is NonNullable<typeof entry> => entry !== null)

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
    const segmentSeconds = this.options.segmentSeconds ?? DEFAULT_SEGMENT_SECONDS
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
      this.lastProgressAt = Date.now()

      const cutoff = new Date(Date.now() - retentionSeconds * 1000)
      const segments = this.repositories.listBufferSegmentsForWindow(
        this.camera.cameraId,
        cutoff.toISOString(),
        endedAt.toISOString()
      )

      safeLog("debug", "Simulated buffer segment recorded", {
        sourceId: this.camera.cameraId,
        resourceId: this.camera.resourceId ?? null,
        segmentCount: segments.length,
      })
    }, segmentSeconds * 1000)
  }
}
