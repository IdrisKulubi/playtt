import type { LatencyEvaluation, LatencySample } from "./types.ts"
import { REPLAY_READY_LATENCY_TARGETS } from "./types.ts"

function percentile(sortedValues: number[], percentile: number): number {
  if (sortedValues.length === 0) {
    return 0
  }

  const index = Math.ceil((percentile / 100) * sortedValues.length) - 1
  return sortedValues[Math.max(0, index)] ?? 0
}

export function evaluateReplayReadyLatency(
  samples: LatencySample[],
  targets = REPLAY_READY_LATENCY_TARGETS,
): LatencyEvaluation {
  const durations = samples.map((sample) => sample.durationMs).sort((a, b) => a - b)
  const p50Ms = percentile(durations, 50)
  const p95Ms = percentile(durations, 95)

  return {
    p50Ms,
    p95Ms,
    sampleCount: durations.length,
    meetsTarget: p50Ms <= targets.p50Ms && p95Ms <= targets.p95Ms,
    targetP50Ms: targets.p50Ms,
    targetP95Ms: targets.p95Ms,
  }
}

export function simulatorReplayReadyLatencySamples(): LatencySample[] {
  return [
    { label: "single_table_buffer_hit", durationMs: 4_200 },
    { label: "single_table_nvr_playback", durationMs: 6_800 },
    { label: "single_table_upload_verify", durationMs: 5_100 },
    { label: "single_table_retry", durationMs: 9_400 },
    { label: "single_table_worst_case", durationMs: 12_600 },
  ]
}
