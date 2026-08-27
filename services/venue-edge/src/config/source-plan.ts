import type { EdgeConfigV2 } from "../cloud/config-v2"

export type SourcePlanAction =
  | "add"
  | "update"
  | "disable"
  | "remove"
  | "unchanged"

export interface SourcePlanEntry {
  sourceId: string
  action: SourcePlanAction
}

export interface SourcePlan {
  entries: SourcePlanEntry[]
  bufferingSourceIds: string[]
}

function sourceIdentity(
  config: EdgeConfigV2,
  source: EdgeConfigV2["sources"][number]
): string {
  const recorder = config.recorders.find(
    (entry) => entry.id === source.recorderId
  )

  return JSON.stringify({
    recorderId: source.recorderId,
    label: source.label,
    channelKey: source.channelKey,
    streamProfile: source.streamProfile,
    codec: source.codec,
    enabled: source.enabled,
    recorder: recorder
      ? {
          enabled: recorder.enabled,
          vendor: recorder.vendor,
          connection: recorder.connection,
          localConnectionKey: recorder.localConnectionKey,
        }
      : null,
  })
}

function bufferingSourceIds(config: EdgeConfigV2): Set<string> {
  const ids = new Set<string>()

  for (const policy of config.resourcePolicies) {
    const resource = config.resources.find(
      (entry) => entry.resourceId === policy.resourceId
    )
    if (!resource?.enabled) {
      continue
    }

    for (const candidate of policy.candidates) {
      const source = config.sources.find(
        (entry) => entry.id === candidate.sourceId
      )
      const recorder = config.recorders.find(
        (entry) => entry.id === source?.recorderId
      )
      if (
        source?.enabled &&
        recorder?.enabled &&
        candidate.captureModes.includes("edge_buffer")
      ) {
        ids.add(source.id)
      }
    }
  }

  return ids
}

export function buildSourcePlan(
  previous: EdgeConfigV2 | null,
  next: EdgeConfigV2
): SourcePlan {
  const nextBuffering = bufferingSourceIds(next)
  const previousBuffering = previous
    ? bufferingSourceIds(previous)
    : new Set<string>()
  const previousById = new Map(
    (previous?.sources ?? []).map((source) => [source.id, source])
  )
  const nextById = new Map(next.sources.map((source) => [source.id, source]))
  const entries: SourcePlanEntry[] = []

  for (const source of next.sources) {
    const prior = previousById.get(source.id)
    const shouldBuffer = nextBuffering.has(source.id)

    if (!prior) {
      entries.push({
        sourceId: source.id,
        action: shouldBuffer ? "add" : "unchanged",
      })
      continue
    }

    if (!source.enabled && prior.enabled) {
      entries.push({ sourceId: source.id, action: "disable" })
      continue
    }

    if (sourceIdentity(next, source) !== sourceIdentity(previous!, prior)) {
      entries.push({ sourceId: source.id, action: "update" })
      continue
    }

    if (shouldBuffer === previousBuffering.has(source.id)) {
      entries.push({ sourceId: source.id, action: "unchanged" })
    } else if (shouldBuffer) {
      entries.push({ sourceId: source.id, action: "add" })
    } else {
      entries.push({ sourceId: source.id, action: "disable" })
    }
  }

  for (const source of previous?.sources ?? []) {
    if (!nextById.has(source.id)) {
      entries.push({ sourceId: source.id, action: "remove" })
    }
  }

  return {
    entries,
    bufferingSourceIds: [...nextBuffering],
  }
}

export function shouldRestartBuffer(
  plan: SourcePlan,
  activeCameraId: string | null
): boolean {
  if (!activeCameraId) {
    return false
  }

  const entry = plan.entries.find((item) => item.sourceId === activeCameraId)
  if (!entry) {
    return true
  }

  return (
    entry.action === "update" ||
    entry.action === "disable" ||
    entry.action === "remove"
  )
}

export function shouldKeepBufferRunning(
  plan: SourcePlan,
  activeCameraId: string | null
): boolean {
  if (!activeCameraId) {
    return false
  }

  const entry = plan.entries.find((item) => item.sourceId === activeCameraId)
  return entry?.action === "unchanged"
}
