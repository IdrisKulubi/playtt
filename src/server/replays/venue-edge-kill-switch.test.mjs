import assert from "node:assert/strict"
import test from "node:test"

import {
  REPLAY_EDGE_FLAG_KEY,
  resolveFeatureFlagEnvFallback,
} from "./feature-env-fallback.ts"
import { isFeatureFlagEnabledForScope } from "./feature-scope.ts"

test("replay_edge kill switch disables replay without affecting scope evaluation", () => {
  const scope = {
    locationIds: ["11111111-1111-1111-1111-111111111111"],
  }

  assert.equal(
    isFeatureFlagEnabledForScope(false, scope, {
      locationId: "11111111-1111-1111-1111-111111111111",
    }),
    false,
  )
  assert.equal(
    isFeatureFlagEnabledForScope(true, scope, {
      locationId: "11111111-1111-1111-1111-111111111111",
    }),
    true,
  )
  assert.equal(REPLAY_EDGE_FLAG_KEY, "replay_edge")
})

test("replay_edge env fallback is independent from other feature flags", () => {
  const originalReplayEnabled = process.env.REPLAY_EDGE_ENABLED
  const originalNodeEnv = process.env.NODE_ENV

  try {
    process.env.NODE_ENV = "production"
    process.env.REPLAY_EDGE_ENABLED = "false"
    assert.equal(resolveFeatureFlagEnvFallback(REPLAY_EDGE_FLAG_KEY), false)
    assert.equal(resolveFeatureFlagEnvFallback("booking"), false)
    assert.equal(resolveFeatureFlagEnvFallback("payments"), false)
  } finally {
    if (originalReplayEnabled === undefined) {
      delete process.env.REPLAY_EDGE_ENABLED
    } else {
      process.env.REPLAY_EDGE_ENABLED = originalReplayEnabled
    }

    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV
    } else {
      process.env.NODE_ENV = originalNodeEnv
    }
  }
})
