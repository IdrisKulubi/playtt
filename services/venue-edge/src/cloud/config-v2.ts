export const EDGE_CONFIG_V2_PROTOCOL_VERSION = "edge-v2" as const

export type ReplayCaptureMode = "edge_buffer" | "nvr_playback"
export type ReplaySelectionMode = "automatic" | "manual"
export type ReplayRecorderVendor = "vigi" | "generic_rtsp"

export interface EdgeConfigV2 {
  protocolVersion: typeof EDGE_CONFIG_V2_PROTOCOL_VERSION
  configRevision: {
    id: string
    version: number
    checksum: string
    publishedAt: string
  }
  installation: {
    id: string
    deviceId: string
    tenantId: string
    venueId: string
    minimumAgentVersion: string
  }
  resources: Array<{
    resourceId: string
    tenantId: string
    venueId: string
    label: string
    enabled: boolean
  }>
  recorders: Array<{
    id: string
    label: string
    vendor: ReplayRecorderVendor
    enabled: boolean
    connection: { host: string; rtspPort: number }
    localConnectionKey: string
  }>
  sources: Array<{
    id: string
    recorderId: string
    label: string
    channelKey: string
    streamProfile: string
    codec: "h264" | "h265"
    enabled: boolean
  }>
  resourcePolicies: Array<{
    resourceId: string
    selectionMode: ReplaySelectionMode
    manualSourceId: string | null
    failover: {
      failureThreshold: number
      cooldownSeconds: number
      healthyThreshold: number
      autoFailback: boolean
    }
    candidates: Array<{
      sourceId: string
      priority: number
      captureModes: ReplayCaptureMode[]
    }>
  }>
}

const SECRET_KEY_PATTERN =
  /(?:password|passwd|secret|token|credential|authorization|api[_-]?key|private[_-]?key)/i

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function scanForSecrets(value: unknown, path = "$"): void {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => scanForSecrets(entry, `${path}[${index}]`))
    return
  }

  if (!isRecord(value)) {
    return
  }

  for (const [key, nested] of Object.entries(value)) {
    if (SECRET_KEY_PATTERN.test(key)) {
      throw new Error(
        `Edge config v2 contains forbidden secret field ${path}.${key}.`
      )
    }
    scanForSecrets(nested, `${path}.${key}`)
  }
}

function requireArray(value: unknown, name: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`Edge config v2 ${name} must be an array.`)
  }
  return value
}

function requireRecord(value: unknown, name: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error(`Edge config v2 ${name} must be an object.`)
  }
  return value
}

function requireString(value: unknown, name: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Edge config v2 ${name} must be a non-empty string.`)
  }
  return value
}

function requirePositiveInteger(value: unknown, name: string): number {
  if (!Number.isInteger(value) || Number(value) <= 0) {
    throw new Error(`Edge config v2 ${name} must be a positive integer.`)
  }
  return Number(value)
}

function requireNonNegativeInteger(value: unknown, name: string): number {
  if (!Number.isInteger(value) || Number(value) < 0) {
    throw new Error(`Edge config v2 ${name} must be a non-negative integer.`)
  }
  return Number(value)
}

function requireBoolean(value: unknown, name: string): boolean {
  if (typeof value !== "boolean") {
    throw new Error(`Edge config v2 ${name} must be a boolean.`)
  }
  return value
}

/**
 * Performs the edge-side trust-boundary checks needed before a cloud snapshot
 * can be persisted. Deeper source activation happens transactionally in the
 * multi-source runtime; this parser deliberately rejects secret-bearing config.
 */
export function parseEdgeConfigV2(input: unknown): EdgeConfigV2 {
  scanForSecrets(input)
  const root = requireRecord(input, "root")

  if (root.protocolVersion !== EDGE_CONFIG_V2_PROTOCOL_VERSION) {
    throw new Error(
      `Unsupported edge config protocol ${String(root.protocolVersion)}.`
    )
  }

  const revision = requireRecord(root.configRevision, "configRevision")
  requireString(revision.id, "configRevision.id")
  requirePositiveInteger(revision.version, "configRevision.version")
  requireString(revision.checksum, "configRevision.checksum")
  requireString(revision.publishedAt, "configRevision.publishedAt")

  const installation = requireRecord(root.installation, "installation")
  const tenantId = requireString(installation.tenantId, "installation.tenantId")
  const venueId = requireString(installation.venueId, "installation.venueId")
  requireString(installation.id, "installation.id")
  requireString(installation.deviceId, "installation.deviceId")
  requireString(
    installation.minimumAgentVersion,
    "installation.minimumAgentVersion"
  )

  const resources = requireArray(root.resources, "resources")
  const recorders = requireArray(root.recorders, "recorders")
  const sources = requireArray(root.sources, "sources")
  const policies = requireArray(root.resourcePolicies, "resourcePolicies")

  const resourceIds = new Set<string>()
  const enabledResourceIds = new Set<string>()
  for (const [index, value] of resources.entries()) {
    const resource = requireRecord(value, `resources[${index}]`)
    const resourceId = requireString(
      resource.resourceId,
      `resources[${index}].resourceId`
    )
    if (resourceIds.has(resourceId)) {
      throw new Error(`Duplicate edge config resource ${resourceId}.`)
    }
    if (resource.tenantId !== tenantId || resource.venueId !== venueId) {
      throw new Error(
        `Edge config resource ${resourceId} crosses installation membership.`
      )
    }
    const enabled = requireBoolean(
      resource.enabled,
      `resources[${index}].enabled`
    )
    resourceIds.add(resourceId)
    if (enabled) {
      enabledResourceIds.add(resourceId)
    }
  }

  const recorderIds = new Set<string>()
  const enabledRecorderIds = new Set<string>()
  for (const [index, value] of recorders.entries()) {
    const recorder = requireRecord(value, `recorders[${index}]`)
    const recorderId = requireString(recorder.id, `recorders[${index}].id`)
    if (recorderIds.has(recorderId)) {
      throw new Error(`Duplicate edge config recorder ${recorderId}.`)
    }
    const connection = requireRecord(
      recorder.connection,
      `recorders[${index}].connection`
    )
    const host = requireString(
      connection.host,
      `recorders[${index}].connection.host`
    )
    if (host.includes("://") || host.includes("@") || host.includes("/")) {
      throw new Error(
        `Recorder ${recorderId} host must not contain credentials or a URL path.`
      )
    }
    requirePositiveInteger(
      connection.rtspPort,
      `recorders[${index}].connection.rtspPort`
    )
    requireString(
      recorder.localConnectionKey,
      `recorders[${index}].localConnectionKey`
    )
    if (recorder.vendor !== "vigi" && recorder.vendor !== "generic_rtsp") {
      throw new Error(`Recorder ${recorderId} has an unsupported vendor.`)
    }
    const enabled = requireBoolean(
      recorder.enabled,
      `recorders[${index}].enabled`
    )
    recorderIds.add(recorderId)
    if (enabled) {
      enabledRecorderIds.add(recorderId)
    }
  }

  const sourceIds = new Set<string>()
  const enabledSourceIds = new Set<string>()
  for (const [index, value] of sources.entries()) {
    const source = requireRecord(value, `sources[${index}]`)
    const sourceId = requireString(source.id, `sources[${index}].id`)
    const recorderId = requireString(
      source.recorderId,
      `sources[${index}].recorderId`
    )
    if (sourceIds.has(sourceId)) {
      throw new Error(`Duplicate edge config source ${sourceId}.`)
    }
    if (!recorderIds.has(recorderId)) {
      throw new Error(
        `Source ${sourceId} references unknown recorder ${recorderId}.`
      )
    }
    if (source.enabled === true && !enabledRecorderIds.has(recorderId)) {
      throw new Error(
        `Enabled source ${sourceId} references a disabled recorder.`
      )
    }
    requireString(source.label, `sources[${index}].label`)
    requireString(source.channelKey, `sources[${index}].channelKey`)
    requireString(source.streamProfile, `sources[${index}].streamProfile`)
    if (source.codec !== "h264" && source.codec !== "h265") {
      throw new Error(`Source ${sourceId} has an unsupported codec.`)
    }
    const enabled = requireBoolean(source.enabled, `sources[${index}].enabled`)
    sourceIds.add(sourceId)
    if (enabled) {
      enabledSourceIds.add(sourceId)
    }
  }

  const policyResourceIds = new Set<string>()
  for (const [policyIndex, value] of policies.entries()) {
    const policy = requireRecord(value, `resourcePolicies[${policyIndex}]`)
    const resourceId = requireString(
      policy.resourceId,
      `resourcePolicies[${policyIndex}].resourceId`
    )
    if (!resourceIds.has(resourceId) || policyResourceIds.has(resourceId)) {
      throw new Error(
        `Invalid or duplicate source policy for resource ${resourceId}.`
      )
    }
    policyResourceIds.add(resourceId)

    const candidates = requireArray(
      policy.candidates,
      `resourcePolicies[${policyIndex}].candidates`
    )
    const candidateIds = new Set<string>()
    const priorities = new Set<number>()
    for (const [candidateIndex, candidateValue] of candidates.entries()) {
      const candidate = requireRecord(
        candidateValue,
        `resourcePolicies[${policyIndex}].candidates[${candidateIndex}]`
      )
      const sourceId = requireString(candidate.sourceId, "candidate.sourceId")
      const priority = requirePositiveInteger(
        candidate.priority,
        "candidate.priority"
      )
      const captureModes = requireArray(
        candidate.captureModes,
        "candidate.captureModes"
      )
      const uniqueCaptureModes = new Set(captureModes)
      if (
        !enabledSourceIds.has(sourceId) ||
        candidateIds.has(sourceId) ||
        priorities.has(priority) ||
        captureModes.length === 0 ||
        uniqueCaptureModes.size !== captureModes.length ||
        captureModes.some(
          (mode) => mode !== "edge_buffer" && mode !== "nvr_playback"
        )
      ) {
        throw new Error(
          `Invalid source candidate ${sourceId} for resource ${resourceId}.`
        )
      }
      candidateIds.add(sourceId)
      priorities.add(priority)
    }
    if (!priorities.has(1)) {
      throw new Error(`Resource ${resourceId} has no primary source.`)
    }
    const failover = requireRecord(policy.failover, "policy.failover")
    requirePositiveInteger(
      failover.failureThreshold,
      "policy.failover.failureThreshold"
    )
    requirePositiveInteger(
      failover.healthyThreshold,
      "policy.failover.healthyThreshold"
    )
    requireNonNegativeInteger(
      failover.cooldownSeconds,
      "policy.failover.cooldownSeconds"
    )
    requireBoolean(failover.autoFailback, "policy.failover.autoFailback")
    if (policy.selectionMode === "manual") {
      const manualSourceId = requireString(
        policy.manualSourceId,
        "manualSourceId"
      )
      if (!candidateIds.has(manualSourceId)) {
        throw new Error(
          `Manual source ${manualSourceId} is not a candidate for ${resourceId}.`
        )
      }
    } else if (
      policy.selectionMode !== "automatic" ||
      policy.manualSourceId !== null
    ) {
      throw new Error(`Resource ${resourceId} has an invalid selection mode.`)
    }
  }

  for (const resourceId of enabledResourceIds) {
    if (!policyResourceIds.has(resourceId)) {
      throw new Error(`Enabled resource ${resourceId} has no source policy.`)
    }
  }

  return input as EdgeConfigV2
}
