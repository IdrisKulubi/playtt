export type SourceHealthScope = "recorder" | "source"

export type SourceHealthStatus =
  | "unknown"
  | "healthy"
  | "degraded"
  | "unhealthy"
  | "disabled"

export type SourceHealthReasonCode =
  | "nvr_unreachable"
  | "source_auth_failed"
  | "codec_incompatible"
  | "buffer_stale"
  | "clock_skew"
  | "probe_failed"
  | "extraction_failed"
  | "upload_failed"
  | "source_disabled"
  | "ffmpeg_exited"
  | "recorder_disabled"

export type ObservationKind =
  | "success"
  | "soft_failure"
  | "hard_failure"
  | "degraded"

export interface HealthThresholds {
  failureThreshold: number
  cooldownSeconds: number
  healthyThreshold: number
  autoFailback: boolean
}

export interface SourceHealthObservation {
  kind: ObservationKind
  reasonCode: SourceHealthReasonCode
  observedAt: string
  details?: Record<string, unknown>
}

export interface SourceHealthRow {
  scope: SourceHealthScope
  recorderId: string
  sourceId: string | null
  status: SourceHealthStatus
  reasonCode: string | null
  consecutiveFailures: number
  consecutiveSuccesses: number
  cooldownUntil: string | null
  observedAt: string
  lastSuccessAt: string | null
  failbackEligible: boolean
  details: Record<string, unknown>
}

export interface HeartbeatSourceHealthEntry {
  sourceId: string
  recorderId: string
  status: string
  reasonCode: string | null
}

export const HARD_FAILURE_REASON_CODES = new Set<SourceHealthReasonCode>([
  "nvr_unreachable",
  "source_auth_failed",
  "codec_incompatible",
])

export const DEGRADED_REASON_CODES = new Set<SourceHealthReasonCode>([
  "buffer_stale",
  "clock_skew",
])

export function mapHealthStatusForCloud(status: SourceHealthStatus): string {
  if (status === "unhealthy") {
    return "offline"
  }

  return status
}
