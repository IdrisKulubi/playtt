import assert from "node:assert/strict"
import test from "node:test"

import {
  RESOURCE_CAPABILITY_CODES,
  isResourceCapabilityCode,
} from "./constants.ts"

test("RESOURCE_CAPABILITY_CODES includes the six catalog capabilities", () => {
  assert.deepEqual(RESOURCE_CAPABILITY_CODES, [
    "scoring",
    "replay",
    "access",
    "lighting",
    "display",
    "camera",
  ])
})

test("isResourceCapabilityCode rejects unknown capability codes", () => {
  assert.equal(isResourceCapabilityCode("scoring"), true)
  assert.equal(isResourceCapabilityCode("golf_bay"), false)
})
