import { assertReplayClip } from "../ffmpeg/media-probe"
import { runFfmpeg } from "../ffmpeg/runner"
import { safeLog } from "../health/metrics"
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

    const inputArgs = [
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
    ]
    let result = await runFfmpeg({
      args: [
        ...inputArgs,
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

    const expectedDuration = request.preRollSeconds + request.postRollSeconds
    let extractionMethod = "stream_copy"
    if (result.exitCode === 0) {
      try {
        await assertReplayClip(request.outputPath, expectedDuration)
      } catch {
        result = { ...result, exitCode: 1 }
      }
    }

    if (result.exitCode !== 0) {
      safeLog("warn", "NVR playback copy failed, retrying with transcode", {
        replayRequestId: request.replayRequestId,
        exitCode: result.exitCode,
        timedOut: result.timedOut,
        stderr: result.stderr.slice(-800),
      })
      extractionMethod = "transcode"
      result = await runFfmpeg({
        args: [
          ...inputArgs,
          "-c:v",
          "libx264",
          "-preset",
          "veryfast",
          "-crf",
          "23",
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
    }

    if (result.exitCode !== 0) {
      throw new Error(result.stderr.trim() || "extraction_failed")
    }

    const validated = await assertReplayClip(request.outputPath, expectedDuration)

    safeLog("info", "Replay clip extracted and validated", {
      replayRequestId: request.replayRequestId,
      captureMode: "nvr_playback",
      extractionMethod,
      durationSeconds: validated.durationSeconds,
      sizeBytes: validated.sizeBytes,
      hasVideo: validated.hasVideo,
    })

    return {
      outputPath: request.outputPath,
      source: "nvr_playback",
      durationSeconds: validated.durationSeconds ?? expectedDuration,
    }
  }
}

export function isVigiAdapterBlockedInProduction(): boolean {
  return isVigiAdapterBlocked()
}
