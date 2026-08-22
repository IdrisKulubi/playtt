import assert from "node:assert/strict"
import test from "node:test"

import { commandMatchesEdgeAssignment } from "../src/cameras/source.ts"
import { PROTOCOL_FIXTURE_EDGE_CONFIG } from "../src/simulator/fixtures.ts"
import { isVigiAdapterBlockedInProduction } from "../src/video-adapters/vigi-nvr-playback-adapter.ts"
import { VigiNvrPlaybackAdapter } from "../src/video-adapters/vigi-nvr-playback-adapter.ts"
import { createReplayLimiter } from "../src/concurrency/limits.ts"

test("wrong resource commands are rejected locally", () => {
  const result = commandMatchesEdgeAssignment(
    PROTOCOL_FIXTURE_EDGE_CONFIG,
    "resource-table-2",
  )

  assert.equal(result.accepted, false)
  assert.equal(result.reason, "resource_mismatch")
})

test("wrong edge role is rejected locally", () => {
  const result = commandMatchesEdgeAssignment(
    {
      ...PROTOCOL_FIXTURE_EDGE_CONFIG,
      role: "display",
    },
    PROTOCOL_FIXTURE_EDGE_CONFIG.resourceId,
  )

  assert.equal(result.accepted, false)
  assert.equal(result.reason, "role_mismatch")
})

test("missing edge config rejects commands", () => {
  const result = commandMatchesEdgeAssignment(null, "resource-table-1")
  assert.equal(result.accepted, false)
  assert.equal(result.reason, "edge_config_unavailable")
})

test("VIGI adapter is blocked in production by default", async () => {
  const previousNodeEnv = process.env.NODE_ENV
  const previousAllow = process.env.VENUE_EDGE_ALLOW_VIGI_ADAPTER

  process.env.NODE_ENV = "production"
  delete process.env.VENUE_EDGE_ALLOW_VIGI_ADAPTER

  assert.equal(isVigiAdapterBlockedInProduction(), true)

  const adapter = new VigiNvrPlaybackAdapter("rtsp://cam/live/1/1/avm")
  assert.equal(await adapter.isAvailable(), false)

  await assert.rejects(
    () =>
      adapter.extractClip({
        replayRequestId: "replay-1",
        captureAt: new Date().toISOString(),
        preRollSeconds: 12,
        postRollSeconds: 3,
        outputPath: "/tmp/clip.mp4",
      }),
    /blocked in production/,
  )

  process.env.NODE_ENV = previousNodeEnv
  if (previousAllow === undefined) {
    delete process.env.VENUE_EDGE_ALLOW_VIGI_ADAPTER
  } else {
    process.env.VENUE_EDGE_ALLOW_VIGI_ADAPTER = previousAllow
  }
})

test("replay concurrency limiter bounds parallel work", async () => {
  const limiter = createReplayLimiter(2)
  let active = 0
  let maxActive = 0

  const task = async () => {
    await limiter.run(async () => {
      active += 1
      maxActive = Math.max(maxActive, active)
      await new Promise((resolve) => setTimeout(resolve, 20))
      active -= 1
    })
  }

  await Promise.all([task(), task(), task(), task()])
  assert.equal(maxActive, 2)
})
