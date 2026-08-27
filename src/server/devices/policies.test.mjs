import assert from "node:assert/strict"
import test from "node:test"

import {
  evaluateConfigAcknowledgement,
  nextHeartbeatTimestamp,
  validateDeviceAssignmentPolicy,
  validateHeartbeatObservedAt,
} from "./policies.mjs"

test("assignment policy rejects wrong device roles and missing capabilities", () => {
  assert.equal(
    validateDeviceAssignmentPolicy({
      role: "score_input",
      deviceType: "ttlock_lock",
      deviceCapabilityCodes: ["access"],
      resourceId: "table-1",
      resourceCapabilityCodes: ["scoring"],
    }).reason,
    "role_not_supported"
  )
  assert.equal(
    validateDeviceAssignmentPolicy({
      role: "score_input",
      deviceType: "esp32_controller",
      deviceCapabilityCodes: ["scoring"],
      resourceId: "table-1",
      resourceCapabilityCodes: ["replay"],
    }).reason,
    "resource_capability_missing"
  )
  assert.deepEqual(
    validateDeviceAssignmentPolicy({
      role: "score_input",
      deviceType: "esp32_controller",
      deviceCapabilityCodes: ["scoring"],
      resourceId: "table-1",
      resourceCapabilityCodes: ["scoring"],
    }),
    { ok: true, requiredCapability: "scoring" }
  )
  assert.equal(
    validateDeviceAssignmentPolicy({
      role: "venue_edge",
      deviceType: "esp32_controller",
      resourceId: "table-1",
      resourceCapabilityCodes: ["replay"],
    }).reason,
    "role_not_supported"
  )
  assert.deepEqual(
    validateDeviceAssignmentPolicy({
      role: "venue_edge",
      deviceType: "venue_edge",
      deviceCapabilityCodes: ["replay"],
      resourceId: null,
      resourceCapabilityCodes: [],
    }),
    { ok: true, requiredCapability: "replay" }
  )
  assert.deepEqual(
    validateDeviceAssignmentPolicy({
      role: "venue_edge",
      deviceType: "venue_edge",
      resourceId: "table-1",
      resourceCapabilityCodes: ["replay"],
    }),
    { ok: true, requiredCapability: "replay" }
  )
})

test("heartbeat timestamps cannot move health backwards or too far forward", () => {
  const now = new Date("2026-08-17T12:00:00.000Z")
  const current = new Date("2026-08-17T11:59:30.000Z")
  const delayed = new Date("2026-08-17T11:58:00.000Z")

  assert.equal(
    validateHeartbeatObservedAt("2026-08-17T12:03:00.000Z", now).reason,
    "future_timestamp"
  )
  assert.equal(nextHeartbeatTimestamp(current, delayed), current)
  assert.equal(
    nextHeartbeatTimestamp(current, now).toISOString(),
    now.toISOString()
  )
})

test("configuration acknowledgements are bounded and monotonic", () => {
  assert.equal(
    evaluateConfigAcknowledgement({
      received: 4,
      configVersion: 3,
      appliedConfigVersion: 2,
    }).kind,
    "ahead"
  )
  assert.equal(
    evaluateConfigAcknowledgement({
      received: 1,
      configVersion: 3,
      appliedConfigVersion: 2,
    }).kind,
    "stale"
  )
  assert.equal(
    evaluateConfigAcknowledgement({
      received: 3,
      configVersion: 3,
      appliedConfigVersion: 2,
    }).kind,
    "apply"
  )
})
