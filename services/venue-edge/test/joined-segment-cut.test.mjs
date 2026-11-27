import assert from "node:assert/strict"
import test from "node:test"

import { canJoinSegmentsAsOneStream } from "../src/video-adapters/rolling-buffer-adapter.ts"

function segments(starts, { length = 2_000, ext = ".ts" } = {}) {
  const base = Date.parse("2026-11-28T10:00:00.000Z")
  return starts.map((offset, index) => ({
    path: `C:\\edge\\buffers\\cam\\segment-${String(index).padStart(9, "0")}${ext}`,
    startedAt: new Date(base + offset).toISOString(),
    endedAt: new Date(base + offset + length).toISOString(),
  }))
}

test("back-to-back segments from one recording can be read as one stream", () => {
  assert.equal(canJoinSegmentsAsOneStream(segments([0, 2_000, 4_000, 6_050])), true)
})

test("a gap (recorder restarted) falls back to the concat demuxer", () => {
  assert.equal(canJoinSegmentsAsOneStream(segments([0, 2_000, 9_000])), false)
})

test("non-TS segments, pipe characters and empty lists are not joined", () => {
  assert.equal(canJoinSegmentsAsOneStream(segments([0, 2_000], { ext: ".mp4" })), false)
  const piped = segments([0, 2_000])
  piped[1].path = "C:\\edge\\a|b\\segment.ts"
  assert.equal(canJoinSegmentsAsOneStream(piped), false)
  assert.equal(canJoinSegmentsAsOneStream([]), false)
})

test("segment length setting accepts 1-6 whole seconds, else the 2 s default", async () => {
  const { parseBufferSegmentSeconds } = await import("../src/config/env.ts")
  assert.equal(parseBufferSegmentSeconds(undefined), 2)
  assert.equal(parseBufferSegmentSeconds("1"), 1)
  assert.equal(parseBufferSegmentSeconds(4), 4)
  assert.equal(parseBufferSegmentSeconds("0"), 2)
  assert.equal(parseBufferSegmentSeconds("1.5"), 2)
  assert.equal(parseBufferSegmentSeconds("abc"), 2)
})
