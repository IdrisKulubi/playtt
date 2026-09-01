import { stat } from "node:fs/promises"

import { safeLog } from "../health/metrics"
import { runFfmpeg } from "./runner"

export interface MediaProbeResult {
  durationSeconds: number | null
  hasVideo: boolean
  sizeBytes: number
  playable: boolean
}

function parseDuration(raw: string): number | null {
  const match = raw.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/i)
  if (!match) return null
  return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3])
}

export async function probeMediaFile(path: string): Promise<MediaProbeResult> {
  const file = await stat(path)
  const result = await runFfmpeg({
    args: ["-i", path, "-map", "0:v:0", "-frames:v", "1", "-f", "null", "-"],
    timeoutMs: 15_000,
    logLevel: "info",
  })
  const raw = `${result.stdout}\n${result.stderr}`
  const durationSeconds = parseDuration(raw)
  const hasVideo = /Video:\s*\w+/i.test(raw)

  return {
    durationSeconds,
    hasVideo,
    sizeBytes: file.size,
    playable:
      result.exitCode === 0 &&
      !result.timedOut &&
      hasVideo &&
      file.size >= 4_096 &&
      durationSeconds !== null &&
      durationSeconds > 0,
  }
}

export async function assertReplayClip(
  path: string,
  expectedDurationSeconds: number,
): Promise<MediaProbeResult> {
  let probe: MediaProbeResult
  try {
    probe = await probeMediaFile(path)
  } catch (error) {
    safeLog("warn", "Replay clip probe could not read media", {
      expectedDurationSeconds,
      message: error instanceof Error ? error.message : String(error),
    })
    throw new Error("clip_validation_failed")
  }
  const minimumDuration = Math.max(1, expectedDurationSeconds - 1.25)
  if (!probe.playable || (probe.durationSeconds ?? 0) < minimumDuration) {
    safeLog("warn", "Replay clip failed media validation", {
      expectedDurationSeconds,
      minimumDurationSeconds: minimumDuration,
      measuredDurationSeconds: probe.durationSeconds,
      sizeBytes: probe.sizeBytes,
      hasVideo: probe.hasVideo,
      playable: probe.playable,
    })
    throw new Error("clip_validation_failed")
  }
  return probe
}
