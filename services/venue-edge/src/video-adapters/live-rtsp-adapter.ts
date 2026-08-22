import { runFfmpeg } from "../ffmpeg/runner"
import type {
  VideoAdapter,
  VideoExtractionRequest,
  VideoExtractionResult,
} from "./types"

export class LiveRtspClipAdapter implements VideoAdapter {
  readonly name = "live-rtsp"

  constructor(private readonly rtspUrl: string | null) {}

  async isAvailable(): Promise<boolean> {
    return Boolean(this.rtspUrl)
  }

  async extractClip(
    request: VideoExtractionRequest,
  ): Promise<VideoExtractionResult> {
    if (!this.rtspUrl) {
      throw new Error("extraction_failed")
    }

    const durationSeconds = request.preRollSeconds + request.postRollSeconds
    const result = await runFfmpeg({
      args: [
        "-rtsp_transport",
        "tcp",
        "-analyzeduration",
        "2000000",
        "-probesize",
        "500000",
        "-i",
        this.rtspUrl,
        "-t",
        String(durationSeconds),
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
      source: "edge_buffer",
      durationSeconds,
    }
  }
}
