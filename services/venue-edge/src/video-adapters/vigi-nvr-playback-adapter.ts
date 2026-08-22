import { runFfmpeg } from "../ffmpeg/runner"
import { buildVigiPlaybackUrl } from "./vigi-urls"
import type {
  VideoAdapter,
  VideoExtractionRequest,
  VideoExtractionResult,
} from "./types"

function isVigiAdapterBlocked(): boolean {
  return (
    process.env.NODE_ENV === "production" &&
    process.env.VENUE_EDGE_ALLOW_VIGI_ADAPTER !== "true"
  )
}

/**
 * VIGI NVR playback fallback — same RTSP replay URL shape as `pnpm probe:vigi`.
 */
export class VigiNvrPlaybackAdapter implements VideoAdapter {
  readonly name = "vigi-nvr-playback"

  constructor(
    private readonly liveRtspUrl: string | null,
    private readonly timeSuffix: "z" | "l" = "z",
  ) {}

  async isAvailable(): Promise<boolean> {
    if (isVigiAdapterBlocked()) {
      return false
    }

    return Boolean(
      this.liveRtspUrl &&
        buildVigiPlaybackUrl(
          this.liveRtspUrl,
          new Date(),
          new Date(),
          this.timeSuffix,
        ),
    )
  }

  async extractClip(
    request: VideoExtractionRequest,
  ): Promise<VideoExtractionResult> {
    if (isVigiAdapterBlocked()) {
      throw new Error(
        "VIGI NVR playback adapter is blocked in production until pilot validation.",
      )
    }

    if (!this.liveRtspUrl) {
      throw new Error("extraction_failed")
    }

    const captureAt = new Date(request.captureAt)
    const start = new Date(captureAt.getTime() - request.preRollSeconds * 1000)
    const end = new Date(captureAt.getTime() + request.postRollSeconds * 1000)
    const playbackUrl = buildVigiPlaybackUrl(
      this.liveRtspUrl,
      start,
      end,
      this.timeSuffix,
    )

    if (!playbackUrl) {
      throw new Error("extraction_failed")
    }

    const result = await runFfmpeg({
      args: [
        "-rtsp_transport",
        "tcp",
        "-analyzeduration",
        "2000000",
        "-probesize",
        "500000",
        "-i",
        playbackUrl,
        "-map",
        "0:v:0",
        "-map",
        "0:a:0?",
        "-c:v",
        "copy",
        "-c:a",
        "aac",
        "-b:a",
        "64k",
        "-ac",
        "1",
        "-ar",
        "16000",
        "-movflags",
        "+faststart",
        "-y",
        request.outputPath,
      ],
      timeoutMs: 90_000,
      logLevel: "warning",
    })

    if (result.exitCode !== 0) {
      throw new Error(result.stderr.trim() || "extraction_failed")
    }

    return {
      outputPath: request.outputPath,
      source: "nvr_playback",
      durationSeconds: request.preRollSeconds + request.postRollSeconds,
    }
  }
}

export function isVigiAdapterBlockedInProduction(): boolean {
  return isVigiAdapterBlocked()
}
