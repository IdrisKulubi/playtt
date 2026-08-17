export const MAX_HEARTBEAT_FUTURE_SKEW_MS = 2 * 60 * 1000

const ROLE_POLICY = {
  score_input: {
    deviceTypes: new Set(["esp32_controller"]),
    capability: "scoring",
    resourceRequired: true,
  },
  lock: {
    deviceTypes: new Set(["ttlock_lock"]),
    capability: "access",
    resourceRequired: false,
  },
  gateway: {
    deviceTypes: new Set(["ttlock_gateway"]),
    capability: "access",
    resourceRequired: false,
    resourceForbidden: true,
  },
  display: {
    deviceTypes: new Set(["esp32_controller"]),
    capability: "display",
    resourceRequired: true,
  },
}

const DEFAULT_TYPE_CAPABILITIES = {
  esp32_controller: new Set(["scoring", "display"]),
  ttlock_lock: new Set(["access"]),
  ttlock_gateway: new Set(["access"]),
}

export function validateDeviceAssignmentPolicy(input) {
  const policy = ROLE_POLICY[input.role]
  if (!policy || !policy.deviceTypes.has(input.deviceType)) {
    return { ok: false, reason: "role_not_supported" }
  }

  if (policy.resourceRequired && !input.resourceId) {
    return { ok: false, reason: "resource_required" }
  }

  if (policy.resourceForbidden && input.resourceId) {
    return { ok: false, reason: "resource_forbidden" }
  }

  const declared = new Set(input.deviceCapabilityCodes ?? [])
  const effectiveCapabilities =
    declared.size > 0
      ? declared
      : (DEFAULT_TYPE_CAPABILITIES[input.deviceType] ?? new Set())

  if (!effectiveCapabilities.has(policy.capability)) {
    return { ok: false, reason: "device_capability_missing" }
  }

  if (
    input.resourceId &&
    !new Set(input.resourceCapabilityCodes ?? []).has(policy.capability)
  ) {
    return { ok: false, reason: "resource_capability_missing" }
  }

  return { ok: true, requiredCapability: policy.capability }
}

export function validateHeartbeatObservedAt(observedAt, now = new Date()) {
  const parsed = observedAt ? new Date(observedAt) : now
  if (Number.isNaN(parsed.getTime())) {
    return { ok: false, reason: "invalid_timestamp" }
  }
  if (parsed.getTime() > now.getTime() + MAX_HEARTBEAT_FUTURE_SKEW_MS) {
    return { ok: false, reason: "future_timestamp" }
  }
  return { ok: true, observedAt: parsed }
}

export function nextHeartbeatTimestamp(current, observedAt) {
  if (!current || observedAt.getTime() > current.getTime()) {
    return observedAt
  }
  return current
}

export function evaluateConfigAcknowledgement(input) {
  if (!Number.isInteger(input.received) || input.received <= 0) {
    return { kind: "invalid" }
  }
  if (input.received > input.configVersion) {
    return { kind: "ahead" }
  }
  if (
    input.appliedConfigVersion !== null &&
    input.received <= input.appliedConfigVersion
  ) {
    return { kind: "stale" }
  }
  return { kind: "apply" }
}
