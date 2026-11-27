import assert from "node:assert/strict"
import test from "node:test"

import { shouldAttachDisplayPlayback } from "./display-playback-hint.ts"

const now = Date.parse("2026-11-28T12:00:00.000Z")
const ready = (overrides = {}) => ({
  replayId: "replay-1",
  status: "ready",
  readyAt: new Date(now - 2_000).toISOString(),
  ...overrides,
})

test("a replay that just became ready is offered to the TV", () => {
  assert.equal(
    shouldAttachDisplayPlayback({ latestReplay: ready(), seenReplayId: null, nowMs: now }),
    true,
  )
})

test("the replay the TV already played is not offered again", () => {
  assert.equal(
    shouldAttachDisplayPlayback({ latestReplay: ready(), seenReplayId: "replay-1", nowMs: now }),
    false,
  )
})

test("old, unready or missing replays are not offered", () => {
  const old = ready({ readyAt: new Date(now - 61_000).toISOString() })
  assert.equal(shouldAttachDisplayPlayback({ latestReplay: old, seenReplayId: null, nowMs: now }), false)
  assert.equal(
    shouldAttachDisplayPlayback({
      latestReplay: ready({ status: "uploading", readyAt: null }),
      seenReplayId: null,
      nowMs: now,
    }),
    false,
  )
  assert.equal(shouldAttachDisplayPlayback({ latestReplay: null, seenReplayId: null, nowMs: now }), false)
})
