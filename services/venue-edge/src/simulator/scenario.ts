import type { SourceHealthEngine } from "../health/engine"
import type { SourceHealthObservation } from "../health/types"

export type SimulatorFailureMode =
  | "none"
  | "nvr_unreachable"
  | "source_auth_failed"
  | "buffer_stale"
  | "extraction_failed"
  | "disabled"

export interface SimulatorSourceScenario {
  sourceId: string
  failureMode?: SimulatorFailureMode
  clockOffsetSeconds?: number
  codec?: "h264" | "h265"
}

export interface SimulatorRecorderScenario {
  recorderId: string
  failureMode?: "none" | "nvr_unreachable" | "source_auth_failed"
}

export interface SimulatorScenario {
  sources?: SimulatorSourceScenario[]
  recorders?: SimulatorRecorderScenario[]
}

export function parseSimulatorScenario(raw: unknown): SimulatorScenario | null {
  if (!raw || typeof raw !== "object") {
    return null
  }

  const record = raw as Record<string, unknown>
  const sources = Array.isArray(record.sources)
    ? record.sources.map((entry) => entry as SimulatorSourceScenario)
    : undefined
  const recorders = Array.isArray(record.recorders)
    ? record.recorders.map((entry) => entry as SimulatorRecorderScenario)
    : undefined

  return { sources, recorders }
}

export function getSourceScenario(
  scenario: SimulatorScenario | null,
  sourceId: string,
): SimulatorSourceScenario | null {
  if (!scenario?.sources) {
    return null
  }

  return scenario.sources.find((entry) => entry.sourceId === sourceId) ?? null
}

export function shouldSimulatedExtractionFail(
  scenario: SimulatorScenario | null,
  sourceId: string,
): boolean {
  const entry = getSourceScenario(scenario, sourceId)
  return entry?.failureMode === "extraction_failed"
}

export function clockOffsetSecondsForSource(
  scenario: SimulatorScenario | null,
  sourceId: string,
): number {
  const entry = getSourceScenario(scenario, sourceId)
  return entry?.clockOffsetSeconds ?? 0
}

export function applySimulatorScenarioToHealth(
  healthEngine: SourceHealthEngine,
  scenario: SimulatorScenario | null,
): void {
  if (!scenario) {
    return
  }

  const observedAt = new Date().toISOString()

  for (const recorder of scenario.recorders ?? []) {
    if (recorder.failureMode === "nvr_unreachable") {
      healthEngine.recordRecorderObservation(recorder.recorderId, {
        kind: "hard_failure",
        reasonCode: "nvr_unreachable",
        observedAt,
      })
    } else if (recorder.failureMode === "source_auth_failed") {
      healthEngine.recordRecorderObservation(recorder.recorderId, {
        kind: "hard_failure",
        reasonCode: "source_auth_failed",
        observedAt,
      })
    }
  }

  for (const source of scenario.sources ?? []) {
    const observation = sourceObservationFromScenario(source, observedAt)
    if (observation) {
      healthEngine.recordSourceObservation(source.sourceId, observation)
    }
  }
}

function sourceObservationFromScenario(
  source: SimulatorSourceScenario,
  observedAt: string,
): SourceHealthObservation | null {
  if (source.codec === "h265") {
    return {
      kind: "hard_failure",
      reasonCode: "codec_incompatible",
      observedAt,
      details: { codec: "h265" },
    }
  }

  switch (source.failureMode) {
    case "disabled":
      return {
        kind: "hard_failure",
        reasonCode: "source_disabled",
        observedAt,
      }
    case "buffer_stale":
      return {
        kind: "degraded",
        reasonCode: "buffer_stale",
        observedAt,
      }
    case "source_auth_failed":
      return {
        kind: "hard_failure",
        reasonCode: "source_auth_failed",
        observedAt,
      }
    case "nvr_unreachable":
      return {
        kind: "hard_failure",
        reasonCode: "nvr_unreachable",
        observedAt,
      }
    case "extraction_failed":
    case "none":
    default:
      return null
  }
}
