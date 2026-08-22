import { readFileSync } from "node:fs"
import { join } from "node:path"
import assert from "node:assert/strict"
import test from "node:test"

import {
  PROTOCOL_FIXTURE_COMMAND,
  PROTOCOL_FIXTURE_EDGE_CONFIG,
} from "../src/simulator/fixtures.ts"
import { commandMatchesEdgeAssignment } from "../src/cameras/source.ts"
import { redactSecrets, safeLog } from "../src/health/metrics.ts"

const packageRoot = join(import.meta.dirname, "..")
const fixtureSource = readFileSync(
  join(packageRoot, "fixtures", "edge-v1.json"),
  "utf8",
)
const fixture = JSON.parse(fixtureSource)

test("edge-v1 protocol fixture is frozen", () => {
  assert.equal(fixture.version, "edge-v1")
  assert.equal(fixture.captureReplayPayload.preRollSeconds, 12)
  assert.equal(fixture.captureReplayPayload.postRollSeconds, 3)
  assert.deepEqual(fixture.progressStatuses, [
    "edge_acknowledged",
    "capturing",
    "extracting",
    "uploading",
    "verifying",
    "ready",
    "edge_offline",
    "buffer_missing",
    "extraction_failed",
    "upload_failed",
    "expired",
    "failed",
  ])
  assert.equal(fixture.routes.replayProgress.path, "/api/edge/v1/replay-requests/:id/progress")
})

test("capture_replay fixture matches cloud payload shape", () => {
  const payload = PROTOCOL_FIXTURE_COMMAND.payload

  assert.equal(payload.preRollSeconds, 12)
  assert.equal(payload.postRollSeconds, 3)
  assert.equal(payload.sourceType, "edge_buffer")
  assert.ok(payload.uploadGrant.url)
  assert.ok(payload.uploadGrant.expiresAt)
})

test("edge config assignment validates resource ownership", () => {
  const accepted = commandMatchesEdgeAssignment(
    PROTOCOL_FIXTURE_EDGE_CONFIG,
    "resource-fixture-001",
  )
  assert.equal(accepted.accepted, true)

  const rejected = commandMatchesEdgeAssignment(
    PROTOCOL_FIXTURE_EDGE_CONFIG,
    "resource-other",
  )
  assert.equal(rejected.accepted, false)
  assert.equal(rejected.reason, "resource_mismatch")
})

test("safe logging redacts secret fields and auth headers", () => {
  const redacted = redactSecrets({
    camera: {
      password: "super-secret",
      label: "table-1",
    },
    Authorization: "Device abc secret-value-123456",
  })

  assert.equal(redacted.camera.password, "[redacted]")
  assert.equal(redacted.camera.label, "table-1")

  const logs = []
  const originalLog = console.log
  console.log = (message) => {
    logs.push(String(message))
  }

  try {
    safeLog("info", "heartbeat", {
      camera: { password: "hidden-password" },
      rtspUrl: "rtsp://user:pass@cam.local/stream",
    })
  } finally {
    console.log = originalLog
  }

  const joined = logs.join("\n")
  assert.doesNotMatch(joined, /hidden-password/)
  assert.doesNotMatch(joined, /pass@cam/)
})

test("cloud client paths align with frozen fixture routes", async () => {
  const { EdgeV1Client } = await import("../src/cloud/client.ts")
  const calls = []

  const fetchImpl = async (url, init) => {
    const parsed = new URL(url)
    calls.push({ path: parsed.pathname, method: init?.method ?? "GET" })

    if (parsed.pathname === "/api/edge/v1/config") {
      return new Response(
        JSON.stringify({ data: PROTOCOL_FIXTURE_EDGE_CONFIG }),
        { status: 200 },
      )
    }

    if (parsed.pathname === "/api/edge/v1/commands") {
      return new Response(
        JSON.stringify({ data: { commands: [PROTOCOL_FIXTURE_COMMAND] } }),
        { status: 200 },
      )
    }

    return new Response(JSON.stringify({ data: {} }), { status: 200 })
  }

  const client = new EdgeV1Client({
    baseUrl: "http://localhost:3000",
    deviceId: "device-1",
    secret: "secret-1",
    fetchImpl: fetchImpl,
  })

  await client.getConfig()
  await client.listCommands()

  assert.deepEqual(calls.map((call) => call.path), [
    "/api/edge/v1/config",
    "/api/edge/v1/commands",
  ])
})

test("buffer_missing after extracting maps to extraction_failed", async () => {
  const { mapReplayFailureStatus } = await import("../src/replay/orchestrator.ts")

  assert.equal(mapReplayFailureStatus("buffer_missing"), "buffer_missing")
  assert.equal(
    mapReplayFailureStatus("buffer_missing", "capturing"),
    "buffer_missing",
  )
  assert.equal(
    mapReplayFailureStatus("buffer_missing", "extracting"),
    "extraction_failed",
  )
})

test("VIGI playback URL is derived from the live RTSP path", async () => {
  const { buildVigiPlaybackUrl } = await import(
    "../src/video-adapters/vigi-urls.ts"
  )

  const url = buildVigiPlaybackUrl(
    "rtsp://playtt_edge:Playtt%4026@192.168.0.82:554/live/1/1/avm",
    new Date("2026-08-22T10:00:00.000Z"),
    new Date("2026-08-22T10:00:15.000Z"),
  )

  assert.match(url ?? "", /\/replay\/1\/1\/avm\?starttime=/)
  assert.match(url ?? "", /192\.168\.0\.82:554/)
})
