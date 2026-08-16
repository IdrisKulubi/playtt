import assert from "node:assert/strict"
import test from "node:test"

import {
  REPLAY_STATUSES,
  formatUnknownEnumValue,
} from "./status-values.ts"

test("unknown replay statuses use the shared fallback formatter", () => {
  assert.equal(formatUnknownEnumValue("awaiting_upload"), "awaiting upload")
})

test("replay status enum remains explicit for known values", () => {
  assert.ok(REPLAY_STATUSES.includes("ready"))
  assert.ok(REPLAY_STATUSES.includes("processing"))
})
