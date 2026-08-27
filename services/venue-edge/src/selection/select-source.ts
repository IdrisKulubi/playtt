import type { EdgeConfigV2, ReplayCaptureMode } from "../cloud/config-v2"
import type { SourceHealthStatus } from "../health/types"
import { isSourceEligible } from "../health/state-machine"

export type CaptureAttemptStatus = "pending" | "skipped" | "succeeded" | "failed"

export type SelectionReason =
  | "manual_pin"
  | "automatic_priority"
  | "failover"
  | "locked_in_progress"

export type TerminalReason =
  | "no_source_configured"
  | "no_healthy_source"
  | "source_disabled"
  | null

export interface CaptureAttemptPlan {
  ordinal: number
  sourceId: string
  recorderId: string
  captureMode: ReplayCaptureMode
  status: CaptureAttemptStatus
  reasonCode: string | null
  selectionReason: SelectionReason
}

export interface LockedSelection {
  sourceId: string
  captureMode: ReplayCaptureMode
}

export interface SourceHealthLookup {
  getStatus(sourceId: string): SourceHealthStatus | null
  getReasonCode(sourceId: string): string | null
}

export interface SelectCapturePlanInput {
  config: EdgeConfigV2
  resourceId: string
  health: SourceHealthLookup
  lockedSelection?: LockedSelection | null
}

export interface SelectCapturePlanResult {
  attempts: CaptureAttemptPlan[]
  selected: {
    sourceId: string
    recorderId: string
    captureMode: ReplayCaptureMode
    selectionReason: SelectionReason
  } | null
  terminalReason: TerminalReason
  configRevisionId: string
}

interface CandidateModePair {
  sourceId: string
  captureMode: ReplayCaptureMode
  priority: number
}

function findResource(config: EdgeConfigV2, resourceId: string) {
  return config.resources.find((entry) => entry.resourceId === resourceId)
}

function findPolicy(config: EdgeConfigV2, resourceId: string) {
  return config.resourcePolicies.find((entry) => entry.resourceId === resourceId)
}

function findSource(config: EdgeConfigV2, sourceId: string) {
  return config.sources.find((entry) => entry.id === sourceId)
}

function findRecorder(config: EdgeConfigV2, recorderId: string) {
  return config.recorders.find((entry) => entry.id === recorderId)
}

function evaluateEligibility(
  config: EdgeConfigV2,
  sourceId: string,
  health: SourceHealthLookup,
): { eligible: boolean; reasonCode: string | null } {
  const source = findSource(config, sourceId)

  if (!source) {
    return { eligible: false, reasonCode: "no_source_configured" }
  }

  const recorder = findRecorder(config, source.recorderId)

  if (!recorder?.enabled) {
    return { eligible: false, reasonCode: "source_disabled" }
  }

  if (!source.enabled) {
    return { eligible: false, reasonCode: "source_disabled" }
  }

  const status = health.getStatus(sourceId)

  if (status === "disabled") {
    return {
      eligible: false,
      reasonCode: health.getReasonCode(sourceId) ?? "source_disabled",
    }
  }

  if (status && !isSourceEligible(status)) {
    return {
      eligible: false,
      reasonCode: health.getReasonCode(sourceId) ?? "probe_failed",
    }
  }

  return { eligible: true, reasonCode: null }
}

function selectionReasonForOrdinal(
  mode: EdgeConfigV2["resourcePolicies"][number]["selectionMode"],
  priority: number,
  locked: boolean,
): SelectionReason {
  if (locked) {
    return "locked_in_progress"
  }

  if (mode === "manual") {
    return "manual_pin"
  }

  if (priority === 1) {
    return "automatic_priority"
  }

  return "failover"
}

function buildCandidateModePairs(
  config: EdgeConfigV2,
  policy: EdgeConfigV2["resourcePolicies"][number],
): CandidateModePair[] {
  if (policy.selectionMode === "manual") {
    const manualSourceId = policy.manualSourceId

    if (!manualSourceId) {
      return []
    }

    const candidate = policy.candidates.find(
      (entry) => entry.sourceId === manualSourceId,
    )

    if (!candidate) {
      return []
    }

    return candidate.captureModes.map((captureMode) => ({
      sourceId: manualSourceId,
      captureMode,
      priority: candidate.priority,
    }))
  }

  const pairs: CandidateModePair[] = []

  const sortedCandidates = [...policy.candidates].sort(
    (left, right) => left.priority - right.priority,
  )

  for (const candidate of sortedCandidates) {
    for (const captureMode of candidate.captureModes) {
      pairs.push({
        sourceId: candidate.sourceId,
        captureMode,
        priority: candidate.priority,
      })
    }
  }

  return pairs
}

export function selectCapturePlan(
  input: SelectCapturePlanInput,
): SelectCapturePlanResult {
  const { config, resourceId, health, lockedSelection } = input
  const configRevisionId = config.configRevision.id

  const resource = findResource(config, resourceId)

  if (!resource?.enabled) {
    return {
      attempts: [],
      selected: null,
      terminalReason: "no_source_configured",
      configRevisionId,
    }
  }

  const policy = findPolicy(config, resourceId)

  if (!policy || policy.candidates.length === 0) {
    return {
      attempts: [],
      selected: null,
      terminalReason: "no_source_configured",
      configRevisionId,
    }
  }

  let pairs: CandidateModePair[]

  if (lockedSelection) {
    const candidate = policy.candidates.find(
      (entry) => entry.sourceId === lockedSelection.sourceId,
    )

    if (
      !candidate ||
      !candidate.captureModes.includes(lockedSelection.captureMode)
    ) {
      return {
        attempts: [],
        selected: null,
        terminalReason: "no_healthy_source",
        configRevisionId,
      }
    }

    pairs = [
      {
        sourceId: lockedSelection.sourceId,
        captureMode: lockedSelection.captureMode,
        priority: candidate.priority,
      },
    ]
  } else {
    pairs = buildCandidateModePairs(config, policy)
  }

  if (pairs.length === 0) {
    return {
      attempts: [],
      selected: null,
      terminalReason:
        policy.selectionMode === "manual" ? "source_disabled" : "no_source_configured",
      configRevisionId,
    }
  }

  const attempts: CaptureAttemptPlan[] = []
  let selected: SelectCapturePlanResult["selected"] = null
  let ordinal = 0

  for (const pair of pairs) {
    ordinal += 1
    const source = findSource(config, pair.sourceId)
    const recorderId = source?.recorderId ?? ""

    const eligibility = evaluateEligibility(config, pair.sourceId, health)
    const selectionReason = selectionReasonForOrdinal(
      policy.selectionMode,
      pair.priority,
      Boolean(lockedSelection),
    )

    if (!eligibility.eligible) {
      attempts.push({
        ordinal,
        sourceId: pair.sourceId,
        recorderId,
        captureMode: pair.captureMode,
        status: "skipped",
        reasonCode: eligibility.reasonCode,
        selectionReason,
      })
      continue
    }

    attempts.push({
      ordinal,
      sourceId: pair.sourceId,
      recorderId,
      captureMode: pair.captureMode,
      status: "pending",
      reasonCode: null,
      selectionReason,
    })

    if (!selected) {
      selected = {
        sourceId: pair.sourceId,
        recorderId,
        captureMode: pair.captureMode,
        selectionReason,
      }
    }
  }

  if (!selected) {
    const terminalReason =
      policy.selectionMode === "manual" && policy.manualSourceId
        ? eligibilityTerminalReason(attempts)
        : "no_healthy_source"

    return {
      attempts,
      selected: null,
      terminalReason,
      configRevisionId,
    }
  }

  return {
    attempts,
    selected,
    terminalReason: null,
    configRevisionId,
  }
}

function eligibilityTerminalReason(
  attempts: CaptureAttemptPlan[],
): TerminalReason {
  const hasDisabled = attempts.some(
    (attempt) => attempt.reasonCode === "source_disabled",
  )

  if (hasDisabled) {
    return "source_disabled"
  }

  return "no_healthy_source"
}

export function buildSelectionAckResult(input: {
  plan: SelectCapturePlanResult
  attempts: Array<{
    ordinal: number
    sourceId: string
    captureMode: ReplayCaptureMode
    status: CaptureAttemptStatus
    reasonCode: string | null
  }>
  selectedSourceId?: string | null
  recorderId?: string | null
  captureMode?: ReplayCaptureMode | null
  selectionReason?: SelectionReason | null
}): Record<string, unknown> {
  return {
    selectedSourceId: input.selectedSourceId ?? input.plan.selected?.sourceId ?? null,
    recorderId: input.recorderId ?? input.plan.selected?.recorderId ?? null,
    captureMode: input.captureMode ?? input.plan.selected?.captureMode ?? null,
    selectionReason:
      input.selectionReason ?? input.plan.selected?.selectionReason ?? null,
    configRevisionId: input.plan.configRevisionId,
    terminalReason: input.plan.terminalReason,
    attempts: input.attempts.map((attempt) => ({
      ordinal: attempt.ordinal,
      sourceId: attempt.sourceId,
      captureMode: attempt.captureMode,
      status: attempt.status,
      reasonCode: attempt.reasonCode,
    })),
  }
}
