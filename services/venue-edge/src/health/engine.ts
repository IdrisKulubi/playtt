import type { EdgeConfigV2 } from "../cloud/config-v2"
import type { EdgeRepositories } from "../local-storage/repositories"
import {
  applyHealthObservation,
  isSourceEligible,
  observationKindForReason,
  resolveThresholdsForRecorder,
  resolveThresholdsForSource,
} from "./state-machine"
import {
  mapHealthStatusForCloud,
  type HeartbeatSourceHealthEntry,
  type SourceHealthObservation,
  type SourceHealthReasonCode,
  type SourceHealthRow,
} from "./types"
import {
  applySimulatorScenarioToHealth,
  type SimulatorScenario,
} from "../simulator/scenario"

const BUFFER_STALE_SECONDS = 120
const CLOCK_SKEW_SECONDS = 30

export interface HealthProbe {
  probeRecorder(recorderId: string): Promise<{
    reachable: boolean
    authFailed?: boolean
  }>
}

export class SourceHealthEngine {
  constructor(
    private readonly repositories: EdgeRepositories,
    private readonly getEdgeConfigV2: () => EdgeConfigV2 | null,
    private readonly probe?: HealthProbe,
    private readonly getSimulatorScenario?: () => SimulatorScenario | null
  ) {}

  getSourceHealth(sourceId: string): SourceHealthRow | null {
    return this.repositories.getSourceHealthBySourceId(sourceId)
  }

  isEligible(sourceId: string): boolean {
    const row = this.getSourceHealth(sourceId)
    if (!row) {
      return true
    }

    return isSourceEligible(row.status)
  }

  syncDisabledFromConfig(): void {
    const config = this.getEdgeConfigV2()
    if (!config) {
      return
    }

    const observedAt = new Date().toISOString()

    for (const recorder of config.recorders) {
      if (!recorder.enabled) {
        this.recordRecorderObservation(recorder.id, {
          kind: "hard_failure",
          reasonCode: "recorder_disabled",
          observedAt,
        })
      }
    }

    for (const source of config.sources) {
      const recorder = config.recorders.find(
        (entry) => entry.id === source.recorderId
      )

      if (!source.enabled || !recorder?.enabled) {
        this.recordSourceObservation(source.id, {
          kind: "hard_failure",
          reasonCode: "source_disabled",
          observedAt,
        })
      }
    }
  }

  recordSourceObservation(
    sourceId: string,
    observation: SourceHealthObservation
  ): SourceHealthRow | null {
    const config = this.getEdgeConfigV2()
    const source = config?.sources.find((entry) => entry.id === sourceId)

    if (!source) {
      return null
    }

    const thresholds = resolveThresholdsForSource(config, sourceId)
    const previous = this.repositories.getSourceHealthRow(
      "source",
      source.recorderId,
      sourceId
    )

    const forceDisabled =
      observation.reasonCode === "source_disabled" ||
      !source.enabled ||
      !config?.recorders.find((entry) => entry.id === source.recorderId)
        ?.enabled

    const next = applyHealthObservation(previous, observation, thresholds, {
      scope: "source",
      recorderId: source.recorderId,
      sourceId,
      forceDisabled,
      disabledReasonCode: "source_disabled",
    })

    return this.repositories.upsertSourceHealth(next)
  }

  recordRecorderObservation(
    recorderId: string,
    observation: SourceHealthObservation
  ): SourceHealthRow | null {
    const config = this.getEdgeConfigV2()
    const recorder = config?.recorders.find((entry) => entry.id === recorderId)

    if (!recorder) {
      return null
    }

    const thresholds = resolveThresholdsForRecorder(config, recorderId)
    const previous = this.repositories.getSourceHealthRow(
      "recorder",
      recorderId,
      null
    )

    const forceDisabled =
      observation.reasonCode === "recorder_disabled" || !recorder.enabled

    const next = applyHealthObservation(previous, observation, thresholds, {
      scope: "recorder",
      recorderId,
      sourceId: null,
      forceDisabled,
      disabledReasonCode: "recorder_disabled",
    })

    const saved = this.repositories.upsertSourceHealth(next)

    if (
      observation.reasonCode === "nvr_unreachable" ||
      observation.reasonCode === "source_auth_failed"
    ) {
      this.fanOutRecorderOutage(recorderId, observation)
    }

    return saved
  }

  private fanOutRecorderOutage(
    recorderId: string,
    observation: SourceHealthObservation
  ): void {
    const config = this.getEdgeConfigV2()
    if (!config) {
      return
    }

    for (const source of config.sources) {
      if (source.recorderId !== recorderId) {
        continue
      }

      this.recordSourceObservation(source.id, {
        kind: observation.kind,
        reasonCode: observation.reasonCode,
        observedAt: observation.observedAt,
        details: { fanoutFromRecorder: recorderId },
      })
    }
  }

  async refreshBufferFreshness(): Promise<void> {
    const config = this.getEdgeConfigV2()
    if (!config) {
      return
    }

    const now = Date.now()
    const observedAt = new Date().toISOString()
    const windowStart = new Date(
      now - BUFFER_STALE_SECONDS * 1000
    ).toISOString()
    const windowEnd = observedAt

    for (const source of config.sources) {
      if (!source.enabled) {
        continue
      }

      const segments = this.repositories.listBufferSegmentsForWindow(
        source.id,
        windowStart,
        windowEnd
      )

      if (segments.length === 0) {
        this.recordSourceObservation(source.id, {
          kind: "degraded",
          reasonCode: "buffer_stale",
          observedAt,
        })
        continue
      }

      const latestEndedAt = segments.reduce((latest, segment) => {
        return Math.max(latest, Date.parse(segment.endedAt))
      }, 0)

      const ageSeconds = (now - latestEndedAt) / 1000

      if (ageSeconds > BUFFER_STALE_SECONDS) {
        this.recordSourceObservation(source.id, {
          kind: "degraded",
          reasonCode: "buffer_stale",
          observedAt,
          details: { bufferAgeSeconds: ageSeconds },
        })
        continue
      }

      const skewSeconds = (latestEndedAt - now) / 1000

      if (skewSeconds > CLOCK_SKEW_SECONDS) {
        this.recordSourceObservation(source.id, {
          kind: "degraded",
          reasonCode: "clock_skew",
          observedAt,
          details: { skewSeconds },
        })
        continue
      }

      this.recordSourceObservation(source.id, {
        kind: "success",
        reasonCode: "probe_failed",
        observedAt,
      })
    }
  }

  async runRecorderProbes(): Promise<void> {
    if (!this.probe) {
      return
    }

    const config = this.getEdgeConfigV2()
    if (!config) {
      return
    }

    const observedAt = new Date().toISOString()

    for (const recorder of config.recorders) {
      if (!recorder.enabled) {
        continue
      }

      const result = await this.probe.probeRecorder(recorder.id)

      if (!result.reachable) {
        this.recordRecorderObservation(recorder.id, {
          kind: "hard_failure",
          reasonCode: "nvr_unreachable",
          observedAt,
        })
        continue
      }

      if (result.authFailed) {
        this.recordRecorderObservation(recorder.id, {
          kind: "hard_failure",
          reasonCode: "source_auth_failed",
          observedAt,
        })
        continue
      }

      this.recordRecorderObservation(recorder.id, {
        kind: "success",
        reasonCode: "probe_failed",
        observedAt,
      })
    }
  }

  async tick(): Promise<void> {
    this.syncDisabledFromConfig()

    const scenario = this.getSimulatorScenario?.() ?? null

    if (scenario) {
      applySimulatorScenarioToHealth(this, scenario)
      return
    }

    await this.refreshBufferFreshness()
    await this.runRecorderProbes()
  }

  recordReplayOutcome(
    sourceId: string | null,
    reasonCode: SourceHealthReasonCode,
    success: boolean
  ): void {
    if (!sourceId) {
      return
    }

    const observedAt = new Date().toISOString()

    if (success) {
      this.recordSourceObservation(sourceId, {
        kind: "success",
        reasonCode: reasonCode,
        observedAt,
      })
      return
    }

    this.recordSourceObservation(sourceId, {
      kind: observationKindForReason(reasonCode),
      reasonCode,
      observedAt,
    })
  }

  getHeartbeatHealthSnapshot(): HeartbeatSourceHealthEntry[] {
    return this.repositories.listAllSourceHealth().map((row) => ({
      sourceId: row.sourceId!,
      recorderId: row.recorderId,
      status: mapHealthStatusForCloud(row.status),
      reasonCode: row.reasonCode,
    }))
  }

  getMaxBufferAgeSeconds(): number | null {
    const rows = this.repositories.listAllSourceHealth()
    let maxAge: number | null = null

    for (const row of rows) {
      const details = row.details as { bufferAgeSeconds?: number } | null
      if (typeof details?.bufferAgeSeconds === "number") {
        maxAge =
          maxAge === null
            ? details.bufferAgeSeconds
            : Math.max(maxAge, details.bufferAgeSeconds)
      }
    }

    return maxAge
  }
}
