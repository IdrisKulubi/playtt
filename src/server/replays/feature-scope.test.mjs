import assert from "node:assert/strict"
import test from "node:test"

import {
  isFeatureFlagEnabledForScope,
  parseFeatureFlagScope,
} from "./feature-scope.ts"

test("parseFeatureFlagScope normalizes venue and resource allowlists", () => {
  assert.deepEqual(
    parseFeatureFlagScope({
      locationIds: ["11111111-1111-1111-1111-111111111111"],
      resourceIds: ["22222222-2222-2222-2222-222222222222"],
    }),
    {
      locationIds: ["11111111-1111-1111-1111-111111111111"],
      resourceIds: ["22222222-2222-2222-2222-222222222222"],
    },
  )
})

test("scope evaluation allows tenant-wide, venue, and resource rollout", () => {
  const scope = {
    locationIds: ["11111111-1111-1111-1111-111111111111"],
    resourceIds: ["22222222-2222-2222-2222-222222222222"],
  }

  assert.equal(
    isFeatureFlagEnabledForScope(true, null, {
      locationId: "11111111-1111-1111-1111-111111111111",
      resourceId: "22222222-2222-2222-2222-222222222222",
    }),
    true,
  )
  assert.equal(
    isFeatureFlagEnabledForScope(true, scope, {
      locationId: "11111111-1111-1111-1111-111111111111",
      resourceId: "22222222-2222-2222-2222-222222222222",
    }),
    true,
  )
  assert.equal(
    isFeatureFlagEnabledForScope(true, scope, {
      locationId: "99999999-9999-4999-8999-999999999999",
      resourceId: "22222222-2222-2222-2222-222222222222",
    }),
    false,
  )
  assert.equal(
    isFeatureFlagEnabledForScope(false, scope, {
      locationId: "11111111-1111-1111-1111-111111111111",
    }),
    false,
  )
})
