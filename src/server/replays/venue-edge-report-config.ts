type Row = Record<string, unknown>

function rows(value: unknown): Row[] {
  return Array.isArray(value) ? value.filter((row): row is Row => Boolean(row) && typeof row === "object" && !Array.isArray(row)) : []
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).sort().join(",")}]`
  if (value && typeof value === "object") return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, entry]) => `${JSON.stringify(key)}:${canonical(entry)}`).join(",")}}`
  return JSON.stringify(value) ?? "null"
}

function host(value: unknown) {
  if (typeof value !== "string") return "127.0.0.1"
  const trimmed = value.trim()
  if (!trimmed) return "127.0.0.1"
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) return trimmed.split("/")[0]
  try { return new URL(trimmed).hostname } catch { return trimmed }
}

function stableTopology(topology: Row): Row | null {
  if (!Array.isArray(topology.recorders) || !Array.isArray(topology.sources) || !Array.isArray(topology.resourcePolicies)) return null
  const recorderKeys = new Map<unknown, string>()
  const sourceKeys = new Map<unknown, string>()
  const identities = new Set<string>()
  const recorders = rows(topology.recorders).map((recorder) => {
    if (typeof recorder.localConnectionKey !== "string" || identities.has(recorder.localConnectionKey) || recorderKeys.has(recorder.id)) return null
    identities.add(recorder.localConnectionKey)
    recorderKeys.set(recorder.id, recorder.localConnectionKey)
    const connection = recorder.connection as Row | undefined
    return { ...recorder, id: recorder.localConnectionKey, connection: { ...connection, host: host(connection?.host).toLowerCase() } }
  })
  identities.clear()
  const sources = rows(topology.sources).map((source) => {
    const recorderKey = recorderKeys.get(source.recorderId)
    if (!recorderKey) return null
    const key = JSON.stringify([recorderKey, source.channelKey, source.streamProfile])
    if (identities.has(key) || sourceKeys.has(source.id)) return null
    identities.add(key)
    sourceKeys.set(source.id, key)
    return { ...source, id: key, recorderId: recorderKey }
  })
  const policies = rows(topology.resourcePolicies).map((policy) => {
    const candidates = rows(policy.candidates).map((candidate) => {
      const sourceKey = sourceKeys.get(candidate.sourceId)
      return sourceKey ? { ...candidate, sourceId: sourceKey } : null
    })
    const manualSourceId = policy.manualSourceId ? sourceKeys.get(policy.manualSourceId) : null
    if (candidates.includes(null) || (policy.manualSourceId && !manualSourceId)) return null
    return { ...policy, manualSourceId, candidates }
  })
  if (recorders.includes(null) || sources.includes(null) || policies.includes(null)) return null
  return { recorders, sources, resourcePolicies: policies }
}

// Reports also include completion, test results and live health. Only compare
// the settings actually delivered in Config v2, never camera/NVR counts alone.
export function commissioningReportMatchesConfig(report: Row | null | undefined, config: Row | null | undefined): boolean {
  if (!report || !config || !Array.isArray(report.nvrs) || !Array.isArray(report.cameras)) return false
  const nvrs = rows(report.nvrs)
  const cameras = rows(report.cameras)
  const enabledNvrs = new Set(nvrs.filter((row) => row.enabled !== false).map((row) => row.id))
  const enabledCameras = new Set(cameras.filter((row) => row.enabled !== false && enabledNvrs.has(row.nvrId)).map((row) => row.id))
  const routes = rows(report.resourceRoutes).filter((row) => row.enabled !== false && enabledCameras.has(row.cameraId))
  const resourceIds = [...new Set(routes.filter((row) => row.priority === 1).map((row) => row.resourceId))]
  const policies = rows(report.resourcePolicies)
  const projected = {
    recorders: nvrs.map((row) => ({ id: row.id, label: row.label ?? "NVR", vendor: row.vendor === "vigi" ? "vigi" : "generic_rtsp", enabled: row.enabled !== false, connection: { host: host(row.host), rtspPort: row.rtspPort ?? 554 }, localConnectionKey: row.localConnectionKey ?? (typeof row.id === "string" ? `local-nvr-${row.id.slice(0, 8)}` : null) })),
    sources: cameras.map((row) => ({ id: row.id, recorderId: row.nvrId, label: row.label ?? "Camera", channelKey: row.channelKey ?? "1", streamProfile: row.streamProfile ?? "main", codec: row.codec === "h265" ? "h265" : "h264", enabled: row.enabled !== false && enabledNvrs.has(row.nvrId) })),
    resourcePolicies: resourceIds.map((resourceId) => {
      const policy = policies.find((row) => row.resourceId === resourceId)
      const candidates = routes.filter((row) => row.resourceId === resourceId).map((row) => ({ sourceId: row.cameraId, priority: row.priority, captureModes: row.captureModes }))
      const manualSourceId = policy?.selectionMode === "manual" && candidates.some((row) => row.sourceId === policy.manualSourceId) ? policy.manualSourceId : null
      return { resourceId, selectionMode: manualSourceId ? "manual" : "automatic", manualSourceId, failover: { failureThreshold: policy?.failureThreshold ?? 3, cooldownSeconds: policy?.cooldownSeconds ?? 60, healthyThreshold: policy?.healthyThreshold ?? 2, autoFailback: policy?.autoFailback ?? true }, candidates }
    }),
  }
  // Reconciliation reuses existing cloud IDs while the local wizard retains its
  // own IDs. Compare the same connection/channel identities used by VenueEdge.
  const reportedTopology = stableTopology(projected)
  const publishedTopology = stableTopology(config)
  return reportedTopology !== null && publishedTopology !== null && canonical(reportedTopology) === canonical(publishedTopology)
}
