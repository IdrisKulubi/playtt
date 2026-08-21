import { randomUUID } from "node:crypto"
import { mkdir } from "node:fs/promises"
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
    const pattern = join(outputDir, "segment-%09d.mp4")

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
        "-segment_time",
        String(segmentSeconds),
        "-reset_timestamps",
        "1",
        pattern,
      ],
    }).catch((error) => {
      safeLog("error", "FFmpeg rolling buffer exited", {
        message: error instanceof Error ? error.message : String(error),
      })
      this.running = false
    })
  }

  async stop(): Promise<void> {
    this.running = false

    if (this.segmentTimer) {
      clearInterval(this.segmentTimer)
      this.segmentTimer = null
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
