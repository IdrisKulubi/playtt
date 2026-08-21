import assert from "node:assert/strict"
import test from "node:test"

import {
  assertFakeMediaStoreAllowed,
  shouldAllowFakeMediaStore,
} from "./stub-policy.ts"

test("shouldAllowFakeMediaStore rejects production regardless of driver", () => {
  assert.equal(
    shouldAllowFakeMediaStore({ environment: "production", driver: "fake" }),
    false,
  )
  assert.equal(
    shouldAllowFakeMediaStore({ environment: "production", driver: undefined }),
    false,
  )
})

test("shouldAllowFakeMediaStore allows non-production when driver is not r2", () => {
  assert.equal(
    shouldAllowFakeMediaStore({ environment: "development", driver: "fake" }),
    true,
  )
})

test("assertFakeMediaStoreAllowed throws in production", () => {
  assert.throws(
    () => assertFakeMediaStoreAllowed("production"),
    /disabled in production/,
  )
})
