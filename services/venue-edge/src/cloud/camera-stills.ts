// Uploads one small JPEG per camera so PlayTT admin can see which camera films
// which table. The picture goes straight to storage through a short-lived
// upload URL; NVR passwords and live video never leave the venue.
import { mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import type { NvrPasswordStore } from "../auth/nvr-secret-store"
import { runFfmpeg, type FfmpegRunOptions, type FfmpegRunResult } from "../ffmpeg/runner"
import { safeLog } from "../health/metrics"
import type { EdgeRepositories } from "../local-storage/repositories"
import { buildVigiLiveRtspUrl } from "../video-adapters/vigi-urls"

export const CAMERA_STILL_INTERVAL_MS = 3 * 60_000
const FIRST_RUN_DELAY_MS = 15_000
const STILL_TIMEOUT_MS = 15_000
const MAX_STILL_BYTES = 512 * 1024

export interface CameraStillGrantClient {
  requestCameraStillGrant(input: {
    localConnectionKey: string
    channelKey: string
    contentLength: number
  }): Promise<{ url: string; contentType: string }>
}

export interface CameraStillPublisherOptions {
  repositories: EdgeRepositories
  passwordStore: NvrPasswordStore
  client: CameraStillGrantClient
  /** False while unpaired or before the first publish; nothing is sent then. */
  isActive: () => boolean
  runFfmpegImpl?: (options: FfmpegRunOptions) => Promise<FfmpegRunResult>
  fetchImpl?: typeof fetch
  intervalMs?: number
}

export class CameraStillPublisher {
  private timer: ReturnType<typeof setTimeout> | null = null
  private running = false
  private readonly runFfmpegImpl: (options: FfmpegRunOptions) => Promise<FfmpegRunResult>
  private readonly fetchImpl: typeof fetch

  constructor(private readonly options: CameraStillPublisherOptions) {
    this.runFfmpegImpl = options.runFfmpegImpl ?? runFfmpeg
    this.fetchImpl = options.fetchImpl ?? fetch
  }

  start(): void {
    if (this.timer) return
    const schedule = (delay: number) => {
      this.timer = setTimeout(async () => {
        await this.publishOnce().catch(() => {})
        if (this.timer) schedule(this.options.intervalMs ?? CAMERA_STILL_INTERVAL_MS)
      }, delay)
      this.timer.unref?.()
    }
    schedule(FIRST_RUN_DELAY_MS)
  }

  stop(): void {
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
  }

  /** Captures and uploads one still per camera. Returns how many were uploaded. */
  async publishOnce(): Promise<number> {
    if (this.running || !this.options.isActive()) return 0
    this.running = true
    let uploaded = 0
    const workDir = await mkdtemp(join(tmpdir(), "venue-edge-stills-"))
    try {
      for (const nvr of this.options.repositories.listLocalNvrs().filter((entry) => entry.enabled)) {
        const password = await this.options.passwordStore.get(nvr.localConnectionKey)
        if (!password) continue
        // One picture per physical channel, whichever stream record exists.
        const channels = [...new Set(this.options.repositories.listLocalCamerasByNvrId(nvr.id).map((camera) => camera.channelKey))]
        for (const channelKey of channels) {
          try {
            const body = await this.captureStill(workDir, { host: nvr.host, rtspPort: nvr.rtspPort, username: nvr.username, password, channelKey })
            if (!body) continue
            const grant = await this.options.client.requestCameraStillGrant({
              localConnectionKey: nvr.localConnectionKey,
              channelKey,
              contentLength: body.byteLength,
            })
            const response = await this.fetchImpl(grant.url, {
              method: "PUT",
              headers: { "content-type": grant.contentType || "image/jpeg" },
              body: new Uint8Array(body),
            })
            if (!response.ok) throw new Error(`upload returned ${response.status}`)
            uploaded += 1
          } catch (error) {
            safeLog("warn", "Camera still upload skipped", {
              nvrId: nvr.id,
              channelKey,
              message: error instanceof Error ? error.message : String(error),
            })
          }
        }
      }
    } finally {
      this.running = false
      await rm(workDir, { recursive: true, force: true }).catch(() => {})
    }
    return uploaded
  }

  /**
   * Grabs one frame, preferring the sub-stream: it's lighter on the recorder,
   * which only allows a few full-resolution viewers at once.
   */
  private async captureStill(
    workDir: string,
    target: { host: string; rtspPort: number; username: string; password: string; channelKey: string },
  ): Promise<Buffer | null> {
    for (const streamProfile of ["sub", "main"] as const) {
      const output = join(workDir, `ch${target.channelKey.replace(/[^A-Za-z0-9_-]/g, "_")}-${streamProfile}.jpg`)
      const result = await this.runFfmpegImpl({
        args: [
          "-rtsp_transport", "tcp",
          "-i", buildVigiLiveRtspUrl({ ...target, streamProfile }),
          "-frames:v", "1",
          "-vf", "scale=640:-2",
          "-q:v", "6",
          "-f", "image2",
          "-y", output,
        ],
        timeoutMs: STILL_TIMEOUT_MS,
        logLevel: "error",
      })
      if (result.exitCode !== 0) continue
      const body = await readFile(output).catch(() => null)
      if (body && body.byteLength > 0 && body.byteLength <= MAX_STILL_BYTES) return body
    }
    return null
  }
}
