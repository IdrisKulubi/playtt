import { mkdir } from "node:fs/promises"
import { dirname, join, relative } from "node:path"

import type { CameraSourceConfig } from "../cameras/source"
import { H264_TRANSCODE_OUTPUT_ARGS } from "../ffmpeg/h264-output"
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

/** Max gap between one segment's end and the next one's start (ms). */
const JOINABLE_SEGMENT_GAP_MS = 1_500

/**
 * True when the segments can be read as one continuous MPEG-TS stream: all
 * .ts files from one unbroken recording (no gap where the recorder restarted),
 * with paths the concat protocol can express.
 */
export function canJoinSegmentsAsOneStream(
  segments: Array<{ path: string; startedAt: string; endedAt: string }>,
): boolean {
  if (segments.length === 0) {
    return false
  }

  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index]!
    if (!segment.path.toLowerCase().endsWith(".ts") || segment.path.includes("|")) {
      return false
    }

    if (index === 0) {
      continue
    }

    const previousEnd = Date.parse(segments[index - 1]!.endedAt)
    const start = Date.parse(segment.startedAt)
    if (
      !Number.isFinite(previousEnd) ||
      !Number.isFinite(start) ||
      Math.abs(start - previousEnd) > JOINABLE_SEGMENT_GAP_MS
    ) {
      return false
    }
  }

  return true
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
      // A local SQLite read: polling often costs nothing and trims the wait.
      await new Promise((resolve) => setTimeout(resolve, 100))
      segments = this.repositories.listBufferSegmentsForWindow(
        this.camera.cameraId,
        windowStart,
        new Date().toISOString(),
      )
    }

    const closedSegments = segments
    const bufferReadyAt = Date.now()
    const timings: Record<string, number | string | boolean | null> = {
      bufferWaitMs: bufferReadyAt - waitStartedAt,
      // How long after the post-roll ended the last segment was closed and
      // indexed (segment length, keyframe interval and indexer tick).
      segmentReadyAfterWindowEndMs: bufferReadyAt - windowEndMs,
      segmentCount: closedSegments.length,
    }
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

    const seekSeconds = String(
      Math.max(
        0,
        (windowStartMs - Date.parse(firstClosedSegment.startedAt)) / 1000,
      ),
    )
    const windowArgs = [
      "-ss",
      seekSeconds,
      "-t",
      String(targetDuration),
      "-map",
      "0:v:0",
      "-map",
      "0:a:0?",
    ]
    // Concat demuxer: opens and analyses every segment separately, and copes
    // with timestamp jumps (e.g. after the recorder restarted). Slow with many
    // short segments (~1.5 s for 21 x 2 s on the venue PC).
    const demuxerInput = [
      "-fflags",
      "+genpts",
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      concatListPath,
      ...windowArgs,
    ]
    // Concat protocol: reads the segments as one continuous MPEG-TS stream, so
    // it is analysed once (~3-4x faster). Only valid when they come from one
    // unbroken recording; otherwise the timestamps jump.
    const joinedInput = canJoinSegmentsAsOneStream(closedSegments)
      ? [
          "-fflags",
          "+genpts",
          "-i",
          `concat:${closedSegments.map((segment) => segment.path).join("|")}`,
          ...windowArgs,
        ]
      : null

    const copyOutputArgs = [
      "-c:v",
      "copy",
      "-c:a",
      "aac",
      "-b:a",
      "64k",
    ]
    const transcodeOutputArgs = [
      ...H264_TRANSCODE_OUTPUT_ARGS,
      "-c:a",
      "aac",
      "-b:a",
      "64k",
    ]
    // Fastest first; strict media validation decides whether to fall back.
    // Transcoding is the last resort for streams that can't be copied.
    const attempts: Array<{
      method: string
      args: string[]
      timeoutMs: number
      timingKey: string
    }> = [
      ...(joinedInput
        ? [
            {
              method: "stream_copy_joined",
              args: [...joinedInput, ...copyOutputArgs],
              timeoutMs: 60_000,
              timingKey: "cutMs",
            },
          ]
        : []),
      {
        method: "stream_copy",
        args: [...demuxerInput, ...copyOutputArgs],
        timeoutMs: 60_000,
        timingKey: joinedInput ? "demuxerCutMs" : "cutMs",
      },
      {
        method: "transcode",
        args: [...demuxerInput, ...transcodeOutputArgs],
        timeoutMs: 90_000,
        timingKey: "transcodeMs",
      },
    ]

    let extractionMethod: string | null = null
    let validated: Awaited<ReturnType<typeof assertReplayClip>> | null = null

    for (const attempt of attempts) {
      const cutStartedAt = Date.now()
      const result = await runFfmpeg({
        args: [
          ...attempt.args,
          "-movflags",
          "+faststart",
          "-y",
          request.outputPath,
        ],
        timeoutMs: attempt.timeoutMs,
        logLevel: "warning",
      })
      timings[attempt.timingKey] = Date.now() - cutStartedAt

      if (result.exitCode === 0) {
        const probeStartedAt = Date.now()
        try {
          validated = await assertReplayClip(request.outputPath, targetDuration)
        } catch {
          validated = null
        }
        timings.probeMs = Date.now() - probeStartedAt
      }

      if (validated) {
        extractionMethod = attempt.method
        break
      }

      safeLog("warn", "Rolling buffer cut failed, trying next method", {
        method: attempt.method,
        exitCode: result.exitCode,
        stderr: result.stderr.slice(-800),
      })
    }

    if (!validated || !extractionMethod) {
      safeLog("warn", "Rolling buffer concat failed", {
        replayRequestId: request.replayRequestId,
        sourceId: this.camera.cameraId,
      })
      throw new Error("extraction_failed")
    }
    timings.extractionMethod = extractionMethod

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
      timings,
    }
  }
}
