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

export type EdgeConfigV2IssueCode =
  | "invalid_shape"
  | "invalid_value"
  | "secret_material"
  | "duplicate_id"
  | "duplicate_priority"
  | "membership_mismatch"
  | "unknown_reference"
  | "inactive_reference"
  | "policy_conflict"

export interface EdgeConfigV2Issue {
  code: EdgeConfigV2IssueCode
  path: string
  message: string
}

export type EdgeConfigV2ValidationResult =
  | { success: true; data: EdgeConfigV2 }
  | { success: false; issues: EdgeConfigV2Issue[] }

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const CHECKSUM_PATTERN = /^sha256:[0-9a-f]{64}$/i
const VERSION_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/
const SECRET_KEY_PATTERN =
  /(?:password|passwd|secret|token|credential|authorization|api[_-]?key|private[_-]?key)/i
const URL_PATTERN = /^[a-z][a-z0-9+.-]*:\/\//i

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function addIssue(
  issues: EdgeConfigV2Issue[],
  code: EdgeConfigV2IssueCode,
  path: string,
  message: string
): void {
  issues.push({ code, path, message })
}

function scanForSecretMaterial(
  value: unknown,
  issues: EdgeConfigV2Issue[],
  path = "$"
): void {
  if (Array.isArray(value)) {
    value.forEach((entry, index) =>
      scanForSecretMaterial(entry, issues, `${path}[${index}]`)
    )
    return
  }
  if (isRecord(value)) {
    for (const [key, nested] of Object.entries(value)) {
      const nestedPath = `${path}.${key}`
      if (SECRET_KEY_PATTERN.test(key)) {
        addIssue(
          issues,
          "secret_material",
          nestedPath,
          "Edge config must not contain secret-bearing fields."
        )
      }
      scanForSecretMaterial(nested, issues, nestedPath)
    }
    return
  }
  if (typeof value !== "string" || !URL_PATTERN.test(value)) return

  try {
    const parsed = new URL(value)
    const secretQuery = [...parsed.searchParams.keys()].some((key) =>
      SECRET_KEY_PATTERN.test(key)
    )
    if (parsed.username || parsed.password || secretQuery) {
      addIssue(
        issues,
        "secret_material",
        path,
        "Credentialized URLs and secret-bearing query parameters are forbidden."
      )
    }
  } catch {
    addIssue(issues, "invalid_value", path, "URL value is malformed.")
  }
}

function objectAt(
  value: unknown,
  path: string,
  issues: EdgeConfigV2Issue[]
): Record<string, unknown> {
  if (!isRecord(value)) {
    addIssue(issues, "invalid_shape", path, "Expected an object.")
    return {}
  }
  return value
}

function arrayAt(
  value: unknown,
  path: string,
  issues: EdgeConfigV2Issue[]
): unknown[] {
  if (!Array.isArray(value)) {
    addIssue(issues, "invalid_shape", path, "Expected an array.")
    return []
  }
  return value
}

function stringAt(
  value: unknown,
  path: string,
  issues: EdgeConfigV2Issue[]
): string {
  if (typeof value !== "string" || value.trim() === "") {
    addIssue(issues, "invalid_value", path, "Expected a non-empty string.")
    return ""
  }
  return value
}

function uuidAt(
  value: unknown,
  path: string,
  issues: EdgeConfigV2Issue[]
): string {
  const id = stringAt(value, path, issues)
  if (id && !UUID_PATTERN.test(id)) {
    addIssue(issues, "invalid_value", path, "Expected a UUID.")
  }
  return id
}

function integerAt(
  value: unknown,
  path: string,
  issues: EdgeConfigV2Issue[],
  minimum = 1
): number {
  if (!Number.isInteger(value) || Number(value) < minimum) {
    addIssue(
      issues,
      "invalid_value",
      path,
      `Expected an integer greater than or equal to ${minimum}.`
    )
    return 0
  }
  return Number(value)
}

function booleanAt(
  value: unknown,
  path: string,
  issues: EdgeConfigV2Issue[]
): boolean {
  if (typeof value !== "boolean") {
    addIssue(issues, "invalid_value", path, "Expected a boolean.")
    return false
  }
  return value
}

function enumAt<T extends string>(
  value: unknown,
  allowed: readonly T[],
  path: string,
  issues: EdgeConfigV2Issue[]
): T {
  const parsed = stringAt(value, path, issues)
  if (!allowed.includes(parsed as T)) {
    addIssue(
      issues,
      "invalid_value",
      path,
      `Expected one of: ${allowed.join(", ")}.`
    )
  }
  return parsed as T
}

function requireUnique(
  values: string[],
  path: string,
  issues: EdgeConfigV2Issue[]
): void {
  const seen = new Set<string>()
  values.forEach((value, index) => {
    if (value && seen.has(value)) {
      addIssue(
        issues,
        "duplicate_id",
        `${path}[${index}]`,
        `Duplicate ID ${value}.`
      )
    }
    seen.add(value)
  })
}

export function validateEdgeConfigV2(
  input: unknown
): EdgeConfigV2ValidationResult {
  const issues: EdgeConfigV2Issue[] = []
  scanForSecretMaterial(input, issues)
  const root = objectAt(input, "$", issues)

  if (root.protocolVersion !== EDGE_CONFIG_V2_PROTOCOL_VERSION) {
    addIssue(
      issues,
      "invalid_value",
      "$.protocolVersion",
      `Expected ${EDGE_CONFIG_V2_PROTOCOL_VERSION}.`
    )
  }

  const revision = objectAt(root.configRevision, "$.configRevision", issues)
  uuidAt(revision.id, "$.configRevision.id", issues)
  integerAt(revision.version, "$.configRevision.version", issues)
  const checksum = stringAt(
    revision.checksum,
    "$.configRevision.checksum",
    issues
  )
  if (checksum && !CHECKSUM_PATTERN.test(checksum)) {
    addIssue(
      issues,
      "invalid_value",
      "$.configRevision.checksum",
      "Expected sha256:<64 hex characters>."
    )
  }
  const publishedAt = stringAt(
    revision.publishedAt,
    "$.configRevision.publishedAt",
    issues
  )
  if (publishedAt && !Number.isFinite(Date.parse(publishedAt))) {
    addIssue(
      issues,
      "invalid_value",
      "$.configRevision.publishedAt",
      "Expected an ISO timestamp."
    )
  }

  const installation = objectAt(root.installation, "$.installation", issues)
  uuidAt(installation.id, "$.installation.id", issues)
  uuidAt(installation.deviceId, "$.installation.deviceId", issues)
  const tenantId = uuidAt(
    installation.tenantId,
    "$.installation.tenantId",
    issues
  )
  const venueId = uuidAt(installation.venueId, "$.installation.venueId", issues)
  const minimumAgentVersion = stringAt(
    installation.minimumAgentVersion,
    "$.installation.minimumAgentVersion",
    issues
  )
  if (minimumAgentVersion && !VERSION_PATTERN.test(minimumAgentVersion)) {
    addIssue(
      issues,
      "invalid_value",
      "$.installation.minimumAgentVersion",
      "Expected a semantic version."
    )
  }

  const resources = arrayAt(root.resources, "$.resources", issues).map(
    (value, index) => {
      const path = `$.resources[${index}]`
      const item = objectAt(value, path, issues)
      const resource = {
        resourceId: uuidAt(item.resourceId, `${path}.resourceId`, issues),
        tenantId: uuidAt(item.tenantId, `${path}.tenantId`, issues),
        venueId: uuidAt(item.venueId, `${path}.venueId`, issues),
        label: stringAt(item.label, `${path}.label`, issues),
        enabled: booleanAt(item.enabled, `${path}.enabled`, issues),
      }
      if (resource.tenantId !== tenantId || resource.venueId !== venueId) {
        addIssue(
          issues,
          "membership_mismatch",
          path,
          "Resource must belong to the installation tenant and venue."
        )
      }
      return resource
    }
  )

  const recorders = arrayAt(root.recorders, "$.recorders", issues).map(
    (value, index) => {
      const path = `$.recorders[${index}]`
      const item = objectAt(value, path, issues)
      const connection = objectAt(item.connection, `${path}.connection`, issues)
      const host = stringAt(connection.host, `${path}.connection.host`, issues)
      if (host.includes("://") || host.includes("@") || host.includes("/")) {
        addIssue(
          issues,
          "secret_material",
          `${path}.connection.host`,
          "Recorder host must not contain a URL, path, or user information."
        )
      }
      return {
        id: uuidAt(item.id, `${path}.id`, issues),
        label: stringAt(item.label, `${path}.label`, issues),
        vendor: enumAt(
          item.vendor,
          ["vigi", "generic_rtsp"] as const,
          `${path}.vendor`,
          issues
        ),
        enabled: booleanAt(item.enabled, `${path}.enabled`, issues),
        connection: {
          host,
          rtspPort: integerAt(
            connection.rtspPort,
            `${path}.connection.rtspPort`,
            issues
          ),
        },
        localConnectionKey: stringAt(
          item.localConnectionKey,
          `${path}.localConnectionKey`,
          issues
        ),
      }
    }
  )

  const sources = arrayAt(root.sources, "$.sources", issues).map(
    (value, index) => {
      const path = `$.sources[${index}]`
      const item = objectAt(value, path, issues)
      return {
        id: uuidAt(item.id, `${path}.id`, issues),
        recorderId: uuidAt(item.recorderId, `${path}.recorderId`, issues),
        label: stringAt(item.label, `${path}.label`, issues),
        channelKey: stringAt(item.channelKey, `${path}.channelKey`, issues),
        streamProfile: stringAt(
          item.streamProfile,
          `${path}.streamProfile`,
          issues
        ),
        codec: enumAt(
          item.codec,
          ["h264", "h265"] as const,
          `${path}.codec`,
          issues
        ),
        enabled: booleanAt(item.enabled, `${path}.enabled`, issues),
      }
    }
  )

  const policies = arrayAt(
    root.resourcePolicies,
    "$.resourcePolicies",
    issues
  ).map((value, policyIndex) => {
    const path = `$.resourcePolicies[${policyIndex}]`
    const item = objectAt(value, path, issues)
    const failover = objectAt(item.failover, `${path}.failover`, issues)
    const candidates = arrayAt(
      item.candidates,
      `${path}.candidates`,
      issues
    ).map((candidateValue, candidateIndex) => {
      const candidatePath = `${path}.candidates[${candidateIndex}]`
      const candidate = objectAt(candidateValue, candidatePath, issues)
      const captureModes = arrayAt(
        candidate.captureModes,
        `${candidatePath}.captureModes`,
        issues
      ).map((mode, modeIndex) =>
        enumAt(
          mode,
          ["edge_buffer", "nvr_playback"] as const,
          `${candidatePath}.captureModes[${modeIndex}]`,
          issues
        )
      )
      if (captureModes.length === 0) {
        addIssue(
          issues,
          "invalid_value",
          `${candidatePath}.captureModes`,
          "At least one capture mode is required."
        )
      }
      if (new Set(captureModes).size !== captureModes.length) {
        addIssue(
          issues,
          "duplicate_id",
          `${candidatePath}.captureModes`,
          "Capture modes must be unique."
        )
      }
      return {
        sourceId: uuidAt(
          candidate.sourceId,
          `${candidatePath}.sourceId`,
          issues
        ),
        priority: integerAt(
          candidate.priority,
          `${candidatePath}.priority`,
          issues
        ),
        captureModes,
      }
    })

    const selectionMode = enumAt(
      item.selectionMode,
      ["automatic", "manual"] as const,
      `${path}.selectionMode`,
      issues
    )
    const manualSourceId =
      item.manualSourceId === null
        ? null
        : uuidAt(item.manualSourceId, `${path}.manualSourceId`, issues)
    if (selectionMode === "automatic" && manualSourceId !== null) {
      addIssue(
        issues,
        "policy_conflict",
        `${path}.manualSourceId`,
        "Automatic selection cannot set a manual source."
      )
    }
    if (selectionMode === "manual" && manualSourceId === null) {
      addIssue(
        issues,
        "policy_conflict",
        `${path}.manualSourceId`,
        "Manual selection requires a source."
      )
    }

    return {
      resourceId: uuidAt(item.resourceId, `${path}.resourceId`, issues),
      selectionMode,
      manualSourceId,
      failover: {
        failureThreshold: integerAt(
          failover.failureThreshold,
          `${path}.failover.failureThreshold`,
          issues
        ),
        cooldownSeconds: integerAt(
          failover.cooldownSeconds,
          `${path}.failover.cooldownSeconds`,
          issues,
          0
        ),
        healthyThreshold: integerAt(
          failover.healthyThreshold,
          `${path}.failover.healthyThreshold`,
          issues
        ),
        autoFailback: booleanAt(
          failover.autoFailback,
          `${path}.failover.autoFailback`,
          issues
        ),
      },
      candidates,
    }
  })

  requireUnique(
    resources.map((item) => item.resourceId),
    "$.resources",
    issues
  )
  requireUnique(
    recorders.map((item) => item.id),
    "$.recorders",
    issues
  )
  requireUnique(
    sources.map((item) => item.id),
    "$.sources",
    issues
  )
  requireUnique(
    policies.map((item) => item.resourceId),
    "$.resourcePolicies",
    issues
  )

  const resourceById = new Map(resources.map((item) => [item.resourceId, item]))
  const recorderById = new Map(recorders.map((item) => [item.id, item]))
  const sourceById = new Map(sources.map((item) => [item.id, item]))

  sources.forEach((source, index) => {
    const recorder = recorderById.get(source.recorderId)
    if (!recorder) {
      addIssue(
        issues,
        "unknown_reference",
        `$.sources[${index}].recorderId`,
        "Source references an unknown recorder."
      )
    } else if (source.enabled && !recorder.enabled) {
      addIssue(
        issues,
        "inactive_reference",
        `$.sources[${index}].recorderId`,
        "Enabled source cannot reference a disabled recorder."
      )
    }
  })

  policies.forEach((policy, policyIndex) => {
    const path = `$.resourcePolicies[${policyIndex}]`
    const resource = resourceById.get(policy.resourceId)
    if (!resource) {
      addIssue(
        issues,
        "membership_mismatch",
        `${path}.resourceId`,
        "Policy resource is not authorized for this installation venue."
      )
    }

    const candidateIds = new Set<string>()
    const priorities = new Set<number>()
    policy.candidates.forEach((candidate, candidateIndex) => {
      const candidatePath = `${path}.candidates[${candidateIndex}]`
      if (candidateIds.has(candidate.sourceId)) {
        addIssue(
          issues,
          "duplicate_id",
          `${candidatePath}.sourceId`,
          "Candidate source IDs must be unique per resource."
        )
      }
      if (priorities.has(candidate.priority)) {
        addIssue(
          issues,
          "duplicate_priority",
          `${candidatePath}.priority`,
          "Candidate priorities must be unique per resource."
        )
      }
      candidateIds.add(candidate.sourceId)
      priorities.add(candidate.priority)

      const source = sourceById.get(candidate.sourceId)
      if (!source) {
        addIssue(
          issues,
          "unknown_reference",
          `${candidatePath}.sourceId`,
          "Candidate references an unknown source."
        )
      } else if (!source.enabled) {
        addIssue(
          issues,
          "inactive_reference",
          `${candidatePath}.sourceId`,
          "Candidate source must be enabled."
        )
      }
    })

    if (resource?.enabled) {
      const priorityOneCount = policy.candidates.filter(
        (candidate) => candidate.priority === 1
      ).length
      if (priorityOneCount !== 1) {
        addIssue(
          issues,
          "policy_conflict",
          `${path}.candidates`,
          "Every enabled routed resource must have exactly one priority 1 candidate."
        )
      }
    }
    if (policy.manualSourceId && !candidateIds.has(policy.manualSourceId)) {
      addIssue(
        issues,
        "policy_conflict",
        `${path}.manualSourceId`,
        "Manual source must be a candidate for the resource."
      )
    }
  })

  resources.forEach((resource, index) => {
    if (
      resource.enabled &&
      !policies.some((policy) => policy.resourceId === resource.resourceId)
    ) {
      addIssue(
        issues,
        "policy_conflict",
        `$.resources[${index}].resourceId`,
        "Every enabled resource must have a source policy."
      )
    }
  })

  if (issues.length > 0) return { success: false, issues }
  return { success: true, data: input as EdgeConfigV2 }
}

export function assertEdgeConfigV2(input: unknown): EdgeConfigV2 {
  const result = validateEdgeConfigV2(input)
  if (!result.success) {
    throw new Error(
      `Invalid edge config v2: ${result.issues
        .map((entry) => `${entry.path}: ${entry.message}`)
        .join("; ")}`
    )
  }
  return result.data
}
