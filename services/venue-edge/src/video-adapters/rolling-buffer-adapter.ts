import { mkdir } from "node:fs/promises"
import { dirname, join } from "node:path"

import type { CameraSourceConfig } from "../cameras/source"
import { runFfmpeg } from "../ffmpeg/runner"
import type { EdgeRepositories } from "../local-storage/repositories"
import type { LocalStoragePaths } from "../local-storage/paths"
import type {
  VideoAdapter,
  VideoExtractionRequest,
  VideoExtractionResult,
} from "./types"

export class RollingBufferVideoAdapter implements VideoAdapter {
  readonly name = "rolling-buffer"

  constructor(
    private readonly camera: CameraSourceConfig,
    private readonly paths: LocalStoragePaths,
    private readonly repositories: EdgeRepositories,
    private readonly options: { simulate?: boolean } = {},
  ) {}

  async isAvailable(): Promise<boolean> {
    if (this.options.simulate) {
      return true
    }

    return Boolean(this.camera.rtspUrl)
  }

  async extractClip(
    request: VideoExtractionRequest,
  ): Promise<VideoExtractionResult> {
    const captureAt = Date.parse(request.captureAt)
    const windowStart = new Date(
      captureAt - request.preRollSeconds * 1000,
    ).toISOString()
    const windowEnd = new Date(
      captureAt + request.postRollSeconds * 1000,
    ).toISOString()

    const segments = this.repositories.listBufferSegmentsForWindow(
      this.camera.cameraId,
      windowStart,
      windowEnd,
    )

    if (segments.length === 0 && !this.options.simulate) {
      throw new Error("buffer_missing")
    }

    await mkdir(dirname(request.outputPath), { recursive: true })

    if (this.options.simulate) {
      const { createMinimalMp4Fixture } = await import(
        "../simulator/fixtures"
      )
      const fixture = createMinimalMp4Fixture(request.replayRequestId)
      await import("node:fs/promises").then(({ writeFile }) =>
        writeFile(request.outputPath, fixture),
      )

      return {
        outputPath: request.outputPath,
        source: "edge_buffer",
        durationSeconds:
          request.preRollSeconds + request.postRollSeconds,
      }
    }

    const concatListPath = join(
      this.paths.pendingForReplay(request.replayRequestId),
      "segments.txt",
    )
    await mkdir(dirname(concatListPath), { recursive: true })

    const concatBody = segments
      .map((segment) => `file '${segment.path.replace(/'/g, "'\\''")}'`)
      .join("\n")

    await import("node:fs/promises").then(({ writeFile }) =>
      writeFile(concatListPath, concatBody, "utf8"),
    )

    const result = await runFfmpeg({
      args: [
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        concatListPath,
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
        "-movflags",
        "+faststart",
        request.outputPath,
      ],
      timeoutMs: 60_000,
    })

    if (result.exitCode !== 0) {
      throw new Error("extraction_failed")
    }

    return {
      outputPath: request.outputPath,
      source: "edge_buffer",
      durationSeconds:
        request.preRollSeconds + request.postRollSeconds,
    }
  }
}
