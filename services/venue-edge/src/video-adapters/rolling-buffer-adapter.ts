import { mkdir } from "node:fs/promises"
import { dirname, join, relative } from "node:path"

import type { CameraSourceConfig } from "../cameras/source"
import { runFfmpeg } from "../ffmpeg/runner"
import { safeLog } from "../health/metrics"
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

    const closedSegments =
      segments.length > 1 ? segments.slice(0, -1) : segments

    if (closedSegments.length === 0 && !this.options.simulate) {
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

    const concatDir = dirname(concatListPath)
    const concatBody = closedSegments
      .map((segment) => {
        const concatPath = relative(concatDir, segment.path).replace(/\\/g, "/")
        return `file '${concatPath.replace(/'/g, "'\\''")}'`
      })
      .join("\n")

    await import("node:fs/promises").then(({ writeFile }) =>
      writeFile(concatListPath, concatBody, "utf8"),
    )

    const concatInput = [
      "-fflags",
      "+genpts",
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
    ]

    let result = await runFfmpeg({
      args: [
        ...concatInput,
        "-c:v",
        "copy",
        "-c:a",
        "aac",
        "-b:a",
        "64k",
        "-movflags",
        "+faststart",
        "-y",
        request.outputPath,
      ],
      timeoutMs: 60_000,
      logLevel: "warning",
    })

    if (result.exitCode !== 0) {
      safeLog("warn", "Rolling buffer concat copy failed, retrying with transcode", {
        exitCode: result.exitCode,
        stderr: result.stderr.slice(-800),
      })

      result = await runFfmpeg({
        args: [
          ...concatInput,
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
      safeLog("warn", "Rolling buffer concat failed", {
        exitCode: result.exitCode,
        stderr: result.stderr.slice(-800),
      })
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
