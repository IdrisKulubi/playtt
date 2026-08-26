import { createHash } from "node:crypto"

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const SENSITIVE_KEY_PATTERN =
  /(?:password|passwd|passphrase|secret|token|credential|authorization|auth|api[_-]?key|private[_-]?key)/i

function asRecord(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {}
  return value
}

function parseConfig(value) {
  if (typeof value !== "string") return asRecord(value)
  try {
    return asRecord(JSON.parse(value))
  } catch {
    return {}
  }
}

function stableUuid(...parts) {
  const bytes = createHash("sha256")
    .update(["playtt-legacy-edge-v1", ...parts].join("\u001f"))
    .digest()
    .subarray(0, 16)
  bytes[6] = (bytes[6] & 0x0f) | 0x50
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = bytes.toString("hex")
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

function inspectUrl(value) {
  if (typeof value !== "string") return null
  try {
    const parsed = new URL(value)
    if (!new Set(["rtsp:", "rtsps:"]).has(parsed.protocol)) return null
    return {
      host: sanitizeHost(parsed.hostname),
      port: sanitizePort(parsed.port),
      credentialBearing: Boolean(
        parsed.username || parsed.password || parsed.search
      ),
    }
  } catch {
    return null
  }
}

function sanitizeHost(value) {
  if (typeof value !== "string") return null
  const host = value.trim()
  if (!host || host.length > 253) return null
  if (host.includes("@") || host.includes("/") || host.includes("\\")) {
    return null
  }
  if (/^[A-Za-z0-9.-]+$/.test(host) || /^[0-9A-Fa-f:]+$/.test(host)) {
    return host
  }
  return null
}

function sanitizePort(value) {
  if (value === null || value === undefined || value === "") return null
  const port = Number(value)
  return Number.isInteger(port) && port > 0 && port <= 65_535 ? port : null
}

function sanitizeLegacyChannel(value) {
  if (typeof value !== "string" && typeof value !== "number") return null
  const channel = String(value).trim()
  return /^\d{1,6}$/.test(channel) ? channel : null
}

function sanitizeStreamProfile(value) {
  if (typeof value !== "string" && typeof value !== "number") return "main"
  const profile = String(value).trim().toLowerCase()
  return /^(?:main|sub|substream|\d{1,3})$/.test(profile) ? profile : "main"
}

function containsLegacyCredential(value, seen = new Set()) {
  if (typeof value === "string") {
    return inspectUrl(value)?.credentialBearing ?? false
  }
  if (!value || typeof value !== "object" || seen.has(value)) return false
  seen.add(value)
  for (const [key, nested] of Object.entries(value)) {
    if (SENSITIVE_KEY_PATTERN.test(key)) return true
    if (containsLegacyCredential(nested, seen)) return true
  }
  return false
}

function skip(assignment, reason) {
  return {
    assignmentId:
      typeof assignment?.assignmentId === "string"
        ? assignment.assignmentId
        : null,
    reason,
  }
}

export function planLegacyVenueEdgeTopology({
  assignments,
  devices,
  resources,
}) {
  const deviceById = new Map(devices.map((device) => [device.id, device]))
  const resourceById = new Map(
    resources.map((resource) => [resource.id, resource])
  )
  const plan = {
    recorders: [],
    sources: [],
    routes: [],
    policies: [],
    secretRefs: [],
    reports: [],
    skipped: [],
  }

  for (const assignment of assignments) {
    if (assignment.role !== "venue_edge") {
      plan.skipped.push(skip(assignment, "role_not_venue_edge"))
      continue
    }
    if (!UUID_PATTERN.test(assignment.assignmentId ?? "")) {
      plan.skipped.push(skip(assignment, "invalid_assignment_id"))
      continue
    }

    const edgeDevice = deviceById.get(assignment.deviceId)
    if (
      !edgeDevice ||
      edgeDevice.type !== "venue_edge" ||
      edgeDevice.tenantId !== assignment.tenantId ||
      edgeDevice.locationId !== assignment.locationId
    ) {
      plan.skipped.push(skip(assignment, "edge_device_scope_mismatch"))
      continue
    }

    const resource = resourceById.get(assignment.resourceId)
    if (
      !resource ||
      resource.tenantId !== assignment.tenantId ||
      resource.locationId !== assignment.locationId
    ) {
      plan.skipped.push(skip(assignment, "resource_scope_mismatch"))
      continue
    }

    const config = parseConfig(assignment.config)
    const configuredCameraId = config.cameraDeviceId
    let cameraDeviceId = null
    if (configuredCameraId !== undefined && configuredCameraId !== null) {
      const cameraDevice = deviceById.get(configuredCameraId)
      if (
        !cameraDevice ||
        cameraDevice.type !== "camera" ||
        cameraDevice.tenantId !== assignment.tenantId ||
        cameraDevice.locationId !== assignment.locationId
      ) {
        plan.skipped.push(skip(assignment, "camera_device_scope_mismatch"))
        continue
      }
      cameraDeviceId = cameraDevice.id
    }

    const camera = asRecord(config.camera)
    const nvr = asRecord(config.nvr)
    const rtsp = inspectUrl(camera.rtspUrl)
    const host = sanitizeHost(nvr.ip) ?? rtsp?.host ?? null
    const rtspPort = sanitizePort(nvr.rtspPort) ?? rtsp?.port ?? null
    const channelKey = sanitizeLegacyChannel(nvr.channel) ?? "legacy"
    const streamProfile = sanitizeStreamProfile(nvr.stream)
    const credentialDetected = containsLegacyCredential(config)

    const recorderId = stableUuid("recorder", assignment.assignmentId)
    const sourceId = stableUuid("source", assignment.assignmentId)
    const routeId = stableUuid("route", assignment.assignmentId)
    const policyId = stableUuid("policy", assignment.assignmentId)
    const secretRefId = stableUuid("secret-ref", assignment.assignmentId)
    const localKey = `unresolved:legacy:${recorderId}`

    plan.recorders.push({
      id: recorderId,
      tenantId: assignment.tenantId,
      locationId: assignment.locationId,
      label: `Legacy NVR ${assignment.assignmentId.slice(0, 8)}`,
      vendor: "legacy",
      host,
      rtspPort,
      connectionConfig: {},
      isEnabled: true,
    })
    plan.sources.push({
      id: sourceId,
      tenantId: assignment.tenantId,
      locationId: assignment.locationId,
      recorderId,
      cameraDeviceId,
      channelKey,
      streamProfile,
      label: "Legacy replay camera",
      liveStreamPath: null,
      playbackConfig: {},
      capabilities: { migratedFrom: "edge-v1", requiresLocalSetup: true },
      isEnabled: true,
    })
    plan.routes.push({
      id: routeId,
      tenantId: assignment.tenantId,
      locationId: assignment.locationId,
      resourceId: resource.id,
      cameraSourceId: sourceId,
      priority: 1,
      captureModes:
        Object.keys(nvr).length > 0
          ? ["edge_buffer", "nvr_playback"]
          : ["edge_buffer"],
      policy: {},
      isEnabled: true,
    })
    plan.policies.push({
      id: policyId,
      tenantId: assignment.tenantId,
      locationId: assignment.locationId,
      resourceId: resource.id,
      selectionMode: "automatic",
      manualSourceId: null,
      failureThreshold: 3,
      healthyThreshold: 2,
      cooldownSeconds: 60,
      autoFailback: true,
    })
    plan.secretRefs.push({
      id: secretRefId,
      tenantId: assignment.tenantId,
      locationId: assignment.locationId,
      edgeDeviceId: edgeDevice.id,
      recorderId,
      localKey,
      credentialVersion: 1,
      username: null,
      status: "reauth_required",
    })
    plan.reports.push({
      assignmentId: assignment.assignmentId,
      tenantId: assignment.tenantId,
      locationId: assignment.locationId,
      resourceId: resource.id,
      credentialDetected,
      requiresLocalSetup: true,
    })
  }

  return plan
}

export function summarizeLegacyVenueEdgePlan(plan) {
  return {
    assignmentsEligible: plan.reports.length,
    assignmentsSkipped: plan.skipped.length,
    credentialBearingAssignments: plan.reports.filter(
      (report) => report.credentialDetected
    ).length,
    recorders: plan.recorders.length,
    sources: plan.sources.length,
    routes: plan.routes.length,
    policies: plan.policies.length,
    unresolvedLocalSecretRefs: plan.secretRefs.length,
    requiresLocalSetup: plan.reports.length,
    skipReasons: Object.fromEntries(
      [...new Set(plan.skipped.map((item) => item.reason))]
        .sort()
        .map((reason) => [
          reason,
          plan.skipped.filter((item) => item.reason === reason).length,
        ])
    ),
  }
}
