import type { EdgeConfigV2 } from "../cloud/config-v2"
import {
  DEGRADED_REASON_CODES,
  HARD_FAILURE_REASON_CODES,
  type HealthThresholds,
  type ObservationKind,
  type SourceHealthObservation,
  type SourceHealthRow,
  type SourceHealthStatus,
} from "./types"

const DEFAULT_THRESHOLDS: HealthThresholds = {
  failureThreshold: 3,
  cooldownSeconds: 60,
  healthyThreshold: 2,
  autoFailback: true,
}

function emptyRow(
  scope: SourceHealthRow["scope"],
  recorderId: string,
  sourceId: string | null,
  observedAt: string,
  failbackEligible: boolean,
): SourceHealthRow {
  return {
    scope,
    recorderId,
    sourceId,
    status: "unknown",
    reasonCode: null,
    consecutiveFailures: 0,
    consecutiveSuccesses: 0,
    cooldownUntil: null,
    observedAt,
    lastSuccessAt: null,
    failbackEligible,
    details: {},
  }
}

function isInCooldown(row: SourceHealthRow, observedAt: string): boolean {
  if (!row.cooldownUntil) {
    return false
  }

  return Date.parse(observedAt) < Date.parse(row.cooldownUntil)
}

export function resolveThresholdsForSource(
  config: EdgeConfigV2 | null,
  sourceId: string,
): HealthThresholds {
  if (!config) {
    return DEFAULT_THRESHOLDS
  }

  let matched = false
  let failureThreshold = 0
  let cooldownSeconds = 0
  let healthyThreshold = 0
  let autoFailback = false

  for (const policy of config.resourcePolicies) {
    for (const candidate of policy.candidates) {
      if (candidate.sourceId !== sourceId) {
        continue
      }

      matched = true
      failureThreshold = Math.max(
        failureThreshold,
        policy.failover.failureThreshold,
      )
      cooldownSeconds = Math.max(
        cooldownSeconds,
        policy.failover.cooldownSeconds,
      )
      healthyThreshold = Math.max(
        healthyThreshold,
        policy.failover.healthyThreshold,
      )

      if (policy.failover.autoFailback) {
        autoFailback = true
      }
    }
  }

  if (!matched) {
    return DEFAULT_THRESHOLDS
  }

  return {
    failureThreshold,
    cooldownSeconds,
    healthyThreshold,
    autoFailback,
  }
}

export function applyHealthObservation(
  previous: SourceHealthRow | null,
  observation: SourceHealthObservation,
  thresholds: HealthThresholds,
  options: {
    scope: SourceHealthRow["scope"]
    recorderId: string
    sourceId: string | null
    forceDisabled?: boolean
    disabledReasonCode?: SourceHealthObservation["reasonCode"]
  },
): SourceHealthRow {
  const row =
    previous ??
    emptyRow(
      options.scope,
      options.recorderId,
      options.sourceId,
      observation.observedAt,
      thresholds.autoFailback,
    )

  const next: SourceHealthRow = {
    ...row,
    observedAt: observation.observedAt,
    failbackEligible: thresholds.autoFailback,
    details: observation.details ? { ...observation.details } : row.details,
  }

  if (options.forceDisabled) {
    next.status = "disabled"
    next.reasonCode =
      options.disabledReasonCode ?? "source_disabled"
    next.consecutiveFailures = 0
    next.consecutiveSuccesses = 0
    next.cooldownUntil = null
    return next
  }

  if (row.status === "disabled" && observation.kind !== "success") {
    return next
  }

  if (observation.kind === "degraded") {
    if (next.status !== "unhealthy") {
      next.status = "degraded"
      next.reasonCode = observation.reasonCode
    }
    return next
  }

  if (observation.kind === "success") {
    if (isInCooldown(next, observation.observedAt)) {
      return next
    }

    next.consecutiveFailures = 0
    next.consecutiveSuccesses += 1
    next.lastSuccessAt = observation.observedAt

    if (next.consecutiveSuccesses >= thresholds.healthyThreshold) {
      next.status = "healthy"
      next.reasonCode = null
      next.cooldownUntil = null
    } else if (next.status === "unknown") {
      next.status = "degraded"
      next.reasonCode = null
    }

    return next
  }

  const isHard =
    observation.kind === "hard_failure" ||
    HARD_FAILURE_REASON_CODES.has(observation.reasonCode)

  if (isHard) {
    next.consecutiveFailures = thresholds.failureThreshold
    next.consecutiveSuccesses = 0
    next.status = "unhealthy"
    next.reasonCode = observation.reasonCode
    next.cooldownUntil = new Date(
      Date.parse(observation.observedAt) +
        thresholds.cooldownSeconds * 1000,
    ).toISOString()
    return next
  }

  next.consecutiveFailures += 1
  next.consecutiveSuccesses = 0
  next.reasonCode = observation.reasonCode

  if (next.consecutiveFailures >= thresholds.failureThreshold) {
    next.status = "unhealthy"
    next.cooldownUntil = new Date(
      Date.parse(observation.observedAt) +
        thresholds.cooldownSeconds * 1000,
    ).toISOString()
  } else if (next.status === "unknown") {
    next.status = "degraded"
  }

  return next
}

export function resolveThresholdsForRecorder(
  config: EdgeConfigV2 | null,
  recorderId: string,
): HealthThresholds {
  if (!config) {
    return DEFAULT_THRESHOLDS
  }

  const sources = config.sources.filter(
    (entry) => entry.recorderId === recorderId,
  )

  if (sources.length === 0) {
    return DEFAULT_THRESHOLDS
  }

  let merged = resolveThresholdsForSource(config, sources[0].id)

  for (let index = 1; index < sources.length; index += 1) {
    const thresholds = resolveThresholdsForSource(config, sources[index].id)
    merged = {
      failureThreshold: Math.max(
        merged.failureThreshold,
        thresholds.failureThreshold,
      ),
      cooldownSeconds: Math.max(
        merged.cooldownSeconds,
        thresholds.cooldownSeconds,
      ),
      healthyThreshold: Math.max(
        merged.healthyThreshold,
        thresholds.healthyThreshold,
      ),
      autoFailback: merged.autoFailback || thresholds.autoFailback,
    }
  }

  return merged
}

export function isSourceEligible(status: SourceHealthStatus): boolean {
  return (
    status === "healthy" ||
    status === "degraded" ||
    status === "unknown"
  )
}

export function observationKindForReason(
  reasonCode: SourceHealthObservation["reasonCode"],
): ObservationKind {
  if (DEGRADED_REASON_CODES.has(reasonCode)) {
    return "degraded"
  }

  if (HARD_FAILURE_REASON_CODES.has(reasonCode)) {
    return "hard_failure"
  }

  return "soft_failure"
}
