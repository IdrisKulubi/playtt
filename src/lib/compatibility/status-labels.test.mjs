import assert from "node:assert/strict"
import test from "node:test"

import { formatUnknownEnumValue } from "./status-values.ts"

test("formatUnknownEnumValue keeps unknown booking statuses readable", () => {
  assert.equal(formatUnknownEnumValue("awaiting_review"), "awaiting review")
})

test("formatUnknownEnumValue keeps unknown payment statuses readable", () => {
  assert.equal(formatUnknownEnumValue("awaiting_capture"), "awaiting capture")
})
