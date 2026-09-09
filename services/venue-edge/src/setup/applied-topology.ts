import type { EdgeConfigV2 } from "../cloud/config-v2"

// Cloud IDs can differ from local IDs. Compare stable connection/channel identities.
export function topologySignature(config: EdgeConfigV2): string {
  const recorderKey = (id: string) => config.recorders.find((r) => r.id === id)?.localConnectionKey ?? id
  const sourceKey = (id: string) => {
    const source = config.sources.find((s) => s.id === id)
    return source ? [recorderKey(source.recorderId), source.channelKey, source.streamProfile].join("|") : id
  }
  const sorted = (rows: unknown[]) => rows.map((row) => JSON.stringify(row)).sort()
  return JSON.stringify({
    recorders: sorted(config.recorders.filter((r) => r.enabled).map((r) => [r.localConnectionKey, r.label, r.connection.host.toLowerCase(), r.connection.rtspPort])),
    sources: sorted(config.sources.filter((s) => s.enabled).map((s) => [sourceKey(s.id), s.label, s.codec])),
    policies: sorted(config.resourcePolicies.filter((p) => p.candidates.length > 0).map((p) => [p.resourceId, p.selectionMode, p.manualSourceId ? sourceKey(p.manualSourceId) : null, p.failover, sorted(p.candidates.map((c) => [sourceKey(c.sourceId), c.priority, [...c.captureModes].sort()]))])),
  })
}
