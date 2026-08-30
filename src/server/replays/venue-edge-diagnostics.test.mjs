import assert from "node:assert/strict"
import test from "node:test"

import {
  diagnosticsContainForbiddenMaterial,
  redactVenueEdgeSecrets,
} from "./venue-edge-redaction.ts"

test("cloud diagnostics redaction matches venue-edge agent secret patterns", () => {
  const pairingCode = "ABCD-EFGHJK"
  const secret = "super-secret-value"
  const uploadUrl =
    "https://bucket.example/upload?X-Amz-Signature=abc123&X-Amz-Credential=foo"

  const redacted = redactVenueEdgeSecrets({
    generatedAt: new Date().toISOString(),
    installation: {
      id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      displayName: "Court A",
    },
    heartbeat: {
      observedAt: new Date().toISOString(),
      metrics: {
        uploadGrant: { url: uploadUrl },
        Authorization: `Device 11111111-1111-1111-1111-111111111111 ${secret}`,
        diskPressure: true,
        diskUsageBytes: 42_000_000_000,
        uploadQueueDepth: 3,
      },
    },
    pairingCode,
    password: "nvr-password",
    camera: {
      streamUrl: "rtsp://user:pass@camera.local/stream",
    },
  })

  const serialized = JSON.stringify(redacted)
  assert.ok(!serialized.includes(secret))
  assert.ok(!serialized.includes(pairingCode))
  assert.ok(!serialized.includes("nvr-password"))
  assert.ok(!serialized.includes("X-Amz-Signature"))
  assert.ok(!serialized.includes("rtsp://user:pass@camera.local/stream"))
  assert.equal(
    diagnosticsContainForbiddenMaterial(redacted, [secret, pairingCode]),
    false,
  )
  assert.equal(redacted.heartbeat.metrics.diskPressure, true)
})
