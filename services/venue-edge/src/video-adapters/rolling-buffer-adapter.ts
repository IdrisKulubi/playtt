import { mkdir } from "node:fs/promises"
import { dirname, join, relative } from "node:path"

import type { CameraSourceConfig } from "../cameras/source"
import { assertReplayClip } from "../ffmpeg/media-probe"
import { runFfmpeg } from "../ffmpeg/runner"
import { safeLog } from "../health/metrics"
import type { EdgeRepositories } from "../local-storage/repositories"
import type { LocalStoragePaths } from "../local-storage/paths"
import type {
  VideoAdapter,
  VideoExtractionRequest,
  VideoExtractionResult,
} from "./types"

const COVERAGE_TOLERANCE_MS = 750
const MAX_SEGMENT_CLOSE_DELAY_MS = 20_000

function coversReplayWindow(
  segments: Array<{ startedAt: string; endedAt: string }>,
  windowStartMs: number,
  windowEndMs: number,
): boolean {
  const first = segments.at(0)
  const last = segments.at(-1)
  return Boolean(
    first &&
      last &&
      Date.parse(first.startedAt) <= windowStartMs + COVERAGE_TOLERANCE_MS &&
      Date.parse(last.endedAt) >= windowEndMs - COVERAGE_TOLERANCE_MS,
  )
}

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

    const targetDuration = request.preRollSeconds + request.postRollSeconds
    const windowStartMs = Date.parse(windowStart)
    const windowEndMs = Date.parse(windowEnd)
    const waitUntil = windowEndMs + MAX_SEGMENT_CLOSE_DELAY_MS
    const waitStartedAt = Date.now()
    let segments = this.repositories.listBufferSegmentsForWindow(
      this.camera.cameraId,
      windowStart,
      windowEnd,
    )

    while (
      !this.options.simulate &&
      Date.now() < waitUntil &&
      (Date.now() < windowEndMs ||
        !coversReplayWindow(segments, windowStartMs, windowEndMs))
    ) {
      await new Promise((resolve) => setTimeout(resolve, 250))
      segments = this.repositories.listBufferSegmentsForWindow(
        this.camera.cameraId,
        windowStart,
        new Date().toISOString(),
      )
    }

    const closedSegments = segments
    const hasFullCoverage = coversReplayWindow(
      closedSegments,
      windowStartMs,
      windowEndMs,
    )

    safeLog("info", "Replay buffer window selected", {
      replayRequestId: request.replayRequestId,
      sourceId: this.camera.cameraId,
      targetDurationSeconds: targetDuration,
      segmentCount: closedSegments.length,
      firstSegmentStartedAt: closedSegments.at(0)?.startedAt ?? null,
      lastSegmentEndedAt: closedSegments.at(-1)?.endedAt ?? null,
      hasFullCoverage,
      waitedMs: Date.now() - waitStartedAt,
    })

    if (!hasFullCoverage && !this.options.simulate) {
      safeLog("warn", "Replay buffer does not fully cover requested window", {
        replayRequestId: request.replayRequestId,
        sourceId: this.camera.cameraId,
        windowStart,
        windowEnd,
        firstSegmentStartedAt: closedSegments.at(0)?.startedAt ?? null,
        lastSegmentEndedAt: closedSegments.at(-1)?.endedAt ?? null,
      })
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

      safeLog("warn", "Simulator wrote a protocol-only replay fixture", {
        replayRequestId: request.replayRequestId,
        sizeBytes: fixture.length,
        playable: false,
      })

      return {
        outputPath: request.outputPath,
        source: "edge_buffer",
        durationSeconds: targetDuration,
      }
    }

    const firstClosedSegment = closedSegments[0]
    if (!firstClosedSegment) {
      throw new Error("buffer_missing")
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
      "-ss",
      String(
        Math.max(
          0,
          (windowStartMs - Date.parse(firstClosedSegment.startedAt)) / 1000,
        ),
      ),
      "-t",
      String(targetDuration),
      "-map",
      "0:v:0",
      "-map",
      "0:a:0?",
    ]

    const copyOutputArgs = [
      "-c:v",
      "copy",
      "-c:a",
      "aac",
      "-b:a",
      "64k",
    ]
    const transcodeOutputArgs = [
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
    ]
    let extractionMethod =
      closedSegments.length > 1 ? "transcode" : "stream_copy"
    let result = await runFfmpeg({
      args: [
        ...concatInput,
        ...(extractionMethod === "transcode"
          ? transcodeOutputArgs
          : copyOutputArgs),
        "-movflags",
        "+faststart",
        "-y",
        request.outputPath,
      ],
      timeoutMs: 60_000,
      logLevel: "warning",
    })

    if (result.exitCode === 0) {
      try {
        await assertReplayClip(request.outputPath, targetDuration)
      } catch {
        result = { ...result, exitCode: 1 }
      }
    }

    if (result.exitCode !== 0 && extractionMethod === "stream_copy") {
      safeLog("warn", "Rolling buffer concat copy failed, retrying with transcode", {
        exitCode: result.exitCode,
        stderr: result.stderr.slice(-800),
      })

      extractionMethod = "transcode"
      result = await runFfmpeg({
        args: [
          ...concatInput,
          ...transcodeOutputArgs,
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

    const validated = await assertReplayClip(request.outputPath, targetDuration)

    safeLog("info", "Replay clip extracted and validated", {
      replayRequestId: request.replayRequestId,
      sourceId: this.camera.cameraId,
      captureMode: "edge_buffer",
      extractionMethod,
      durationSeconds: validated.durationSeconds,
      sizeBytes: validated.sizeBytes,
      hasVideo: validated.hasVideo,
    })

    return {
      outputPath: request.outputPath,
      source: "edge_buffer",
      durationSeconds: validated.durationSeconds ?? targetDuration,
    }
  }
}
