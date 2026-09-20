import type { EdgeConfigV2 } from "../cloud/config-v2"

function canonicalJson(value: unknown): string {
  const canonicalize = (current: unknown): unknown => {
    if (Array.isArray(current)) return current.map(canonicalize)
    if (current && typeof current === "object") {
      return Object.fromEntries(
        Object.entries(current as Record<string, unknown>)
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([key, nested]) => [key, canonicalize(nested)]),
      )
    }
    return current
  }

  return JSON.stringify(canonicalize(value))
}

// Cloud IDs can differ from local IDs. Compare stable connection/channel identities.
export function topologySignature(config: EdgeConfigV2): string {
  const recorderKey = (id: string) => config.recorders.find((r) => r.id === id)?.localConnectionKey ?? id
  const sourceKey = (id: string) => {
    const source = config.sources.find((s) => s.id === id)
    return source ? [recorderKey(source.recorderId), source.channelKey, source.streamProfile].join("|") : id
  }
  // PostgreSQL JSON and locally constructed objects can contain identical values
  // with different property insertion order. Canonicalize nested objects before
  // signing so delivery state reflects topology, not JavaScript key order.
  const sorted = (rows: unknown[]) => rows.map(canonicalJson).sort()
  return JSON.stringify({
    recorders: sorted(config.recorders.filter((r) => r.enabled).map((r) => [r.localConnectionKey, r.label, r.connection.host.toLowerCase(), r.connection.rtspPort])),
    sources: sorted(config.sources.filter((s) => s.enabled).map((s) => [sourceKey(s.id), s.label, s.codec])),
    policies: sorted(config.resourcePolicies.filter((p) => p.candidates.length > 0).map((p) => [p.resourceId, p.selectionMode, p.manualSourceId ? sourceKey(p.manualSourceId) : null, p.failover, sorted(p.candidates.map((c) => [sourceKey(c.sourceId), c.priority, [...c.captureModes].sort()]))])),
  })
}
