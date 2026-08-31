export interface Phase8CertificationStep {
  id: string
  title: string
  passed: boolean
  details?: Record<string, unknown>
}

export interface Phase8CertificationReport {
  generatedAt: string
  mode: "simulator" | "hardware"
  passed: boolean
  steps: Phase8CertificationStep[]
}

export interface LatencySample {
  label: string
  durationMs: number
}

export interface LatencyEvaluation {
  p50Ms: number
  p95Ms: number
  sampleCount: number
  meetsTarget: boolean
  targetP50Ms: number
  targetP95Ms: number
}

export const REPLAY_READY_LATENCY_TARGETS = {
  p50Ms: 7_000,
  p95Ms: 15_000,
} as const
