import assert from "node:assert/strict"
import test from "node:test"

import { ReplayTimer } from "../src/replay/timing.ts"

function fakeClock(startMs) {
  let now = startMs
  return {
    now: () => now,
    advance: (ms) => {
      now += ms
    },
  }
}

test("ReplayTimer measures stages, tap offsets and upload speed", async () => {
  const captureAtMs = Date.parse("2026-11-28T10:00:00.000Z")
  const clock = fakeClock(captureAtMs + 800)
  const timer = new ReplayTimer(captureAtMs, clock.now)

  await timer.time("extractMs", async () => {
    clock.advance(5_000)
  })
  timer.set("sizeBytes", 10_000_000)
  timer.set("uploadMs", 4_000)
  clock.advance(4_000)
  timer.markSinceTap("tapToVerifiedMs")
  timer.merge({ cutMs: 420, extractionMethod: "stream_copy", skipped: undefined })

  const summary = timer.summary("ready")

  assert.equal(summary.outcome, "ready")
  assert.equal(summary.tapToEdgeMs, 800)
  assert.equal(summary.extractMs, 5_000)
  assert.equal(summary.tapToVerifiedMs, 9_800)
  assert.equal(summary.cutMs, 420)
  assert.equal(summary.extractionMethod, "stream_copy")
  assert.equal("skipped" in summary, false)
  // 10 MB in 4 s = 20 Mbit/s.
  assert.equal(summary.uploadMbps, 20)
  assert.equal(summary.edgeTotalMs, 9_000)
  assert.equal(summary.tapToReadyMs, 9_800)
})

test("ReplayTimer records a stage that throws and tolerates a bad captureAt", async () => {
  const clock = fakeClock(1_000)
  const timer = new ReplayTimer(Number.NaN, clock.now, 500)

  await assert.rejects(
    timer.time("uploadMs", async () => {
      clock.advance(250)
      throw new Error("upload_failed")
    }),
  )

  const summary = timer.summary("failed")
  assert.equal(summary.uploadMs, 250)
  assert.equal(summary.tapToEdgeMs, null)
  assert.equal(summary.tapToReadyMs, null)
  assert.equal(summary.uploadMbps, null)
  assert.equal(summary.edgeTotalMs, 750)
})
