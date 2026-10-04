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
  return canonical(projected) === canonical({ recorders: config.recorders, sources: config.sources, resourcePolicies: config.resourcePolicies })
}
