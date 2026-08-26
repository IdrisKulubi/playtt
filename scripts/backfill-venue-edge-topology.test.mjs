import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import {
  planLegacyVenueEdgeTopology,
  summarizeLegacyVenueEdgePlan,
} from "./lib/venue-edge-topology-backfill.mjs"

const tenantId = "11111111-1111-4111-8111-111111111111"
const locationId = "22222222-2222-4222-8222-222222222222"
const resourceId = "33333333-3333-4333-8333-333333333333"
const edgeDeviceId = "44444444-4444-4444-8444-444444444444"
const cameraDeviceId = "55555555-5555-4555-8555-555555555555"
const assignmentId = "66666666-6666-4666-8666-666666666666"

function fixture(overrides = {}) {
  return {
    assignments: [
      {
        assignmentId,
        tenantId,
        locationId,
        resourceId,
        deviceId: edgeDeviceId,
        role: "venue_edge",
        config: {
          cameraDeviceId,
          camera: {
            id: "table-1-primary",
            label: "Table 1 overhead",
            rtspUrl:
              "rtsp://legacy-user:legacy-password@192.168.10.20:554/live/1?token=do-not-copy",
          },
          nvr: {
            ip: "192.168.10.20",
            channel: 1,
            stream: "main",
            playbackTimeSuffix: "z",
          },
        },
      },
    ],
    devices: [
      {
        id: edgeDeviceId,
        tenantId,
        locationId,
        type: "venue_edge",
      },
      {
        id: cameraDeviceId,
        tenantId,
        locationId,
        type: "camera",
      },
    ],
    resources: [{ id: resourceId, tenantId, locationId, name: "Table 1" }],
    ...overrides,
  }
}

test("authenticated legacy RTSP becomes sanitized topology plus unresolved local ref", () => {
  const plan = planLegacyVenueEdgeTopology(fixture())
  assert.equal(plan.skipped.length, 0)
  assert.equal(plan.recorders.length, 1)
  assert.equal(plan.recorders[0].host, "192.168.10.20")
  assert.equal(plan.recorders[0].rtspPort, 554)
  assert.deepEqual(plan.recorders[0].connectionConfig, {})
  assert.equal(plan.sources[0].liveStreamPath, null)
  assert.deepEqual(plan.sources[0].playbackConfig, {})
  assert.deepEqual(plan.routes[0].captureModes, ["edge_buffer", "nvr_playback"])
  assert.equal(plan.secretRefs[0].status, "reauth_required")
  assert.match(plan.secretRefs[0].localKey, /^unresolved:legacy:/)
  assert.equal(plan.secretRefs[0].username, null)
  assert.equal(plan.reports[0].credentialDetected, true)

  const serialized = JSON.stringify(plan)
  assert.doesNotMatch(serialized, /legacy-password|legacy-user|do-not-copy/)
  assert.doesNotMatch(serialized, /rtsp:\/\//)
})

test("minimal v1 camera config maps without inventing cloud credentials", () => {
  const input = fixture()
  input.assignments[0].config = {
    camera: { rtspUrl: "rtsp://cam.local/live" },
  }
  const plan = planLegacyVenueEdgeTopology(input)
  assert.equal(plan.recorders[0].host, "cam.local")
  assert.deepEqual(plan.routes[0].captureModes, ["edge_buffer"])
  assert.equal(plan.reports[0].credentialDetected, false)
  assert.equal(plan.secretRefs[0].status, "reauth_required")
})

test("cross-tenant and cross-venue references are skipped", () => {
  const edgeMismatch = fixture({
    devices: [
      {
        id: edgeDeviceId,
        tenantId,
        locationId: "77777777-7777-4777-8777-777777777777",
        type: "venue_edge",
      },
    ],
  })
  assert.deepEqual(
    planLegacyVenueEdgeTopology(edgeMismatch).skipped.map(
      (item) => item.reason
    ),
    ["edge_device_scope_mismatch"]
  )

  const resourceMismatch = fixture({
    resources: [
      {
        id: resourceId,
        tenantId: "88888888-8888-4888-8888-888888888888",
        locationId,
        name: "Wrong tenant",
      },
    ],
  })
  assert.deepEqual(
    planLegacyVenueEdgeTopology(resourceMismatch).skipped.map(
      (item) => item.reason
    ),
    ["resource_scope_mismatch"]
  )
})

test("cross-venue configured camera prevents ambiguous migration", () => {
  const input = fixture()
  input.devices[1].locationId = "99999999-9999-4999-8999-999999999999"
  const plan = planLegacyVenueEdgeTopology(input)
  assert.equal(plan.recorders.length, 0)
  assert.deepEqual(
    plan.skipped.map((item) => item.reason),
    ["camera_device_scope_mismatch"]
  )
})

test("planning is deterministic and summary contains no legacy config", () => {
  const first = planLegacyVenueEdgeTopology(fixture())
  const second = planLegacyVenueEdgeTopology(fixture())
  assert.deepEqual(first, second)
  assert.deepEqual(summarizeLegacyVenueEdgePlan(first), {
    assignmentsEligible: 1,
    assignmentsSkipped: 0,
    credentialBearingAssignments: 1,
    recorders: 1,
    sources: 1,
    routes: 1,
    policies: 1,
    unresolvedLocalSecretRefs: 1,
    requiresLocalSetup: 1,
    skipReasons: {},
  })
})

test("runner defaults to dry-run and preserves v1 assignment rows", () => {
  const runner = readFileSync(
    new URL("./backfill-venue-edge-topology.mjs", import.meta.url),
    "utf8"
  )
  assert.match(runner, /Default behavior is a read-only dry run/)
  assert.match(runner, /--confirm-legacy-edge-backfill/)
  assert.match(runner, /configPublished: false/)
  assert.doesNotMatch(runner, /(?:update|delete from)\s+device_assignments/i)
  assert.doesNotMatch(runner, /insert into venue_edge_config_revisions/i)
  assert.doesNotMatch(
    runner,
    /console\.(?:log|error)\([^\n]*(?:row|assignment)\.config/i
  )
})
