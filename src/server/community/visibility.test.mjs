import assert from "node:assert/strict"
import test from "node:test"

import { toCommunityDisplayName } from "./display-name.ts"
import { consumeCommunityRateLimit, resetCommunityRateLimits } from "./rate-limit.ts"
import { canMessage, canSee, isRallyPartner } from "./visibility.ts"

function facts(overrides = {}) {
  return {
    viewerId: "viewer",
    targetId: "target",
    targetCommunityVisible: true,
    targetRequestPolicy: "everyone",
    viewerBlockedTarget: false,
    targetBlockedViewer: false,
    viewerFollowsTarget: false,
    targetFollowsViewer: false,
    ...overrides,
  }
}

test("visible, unblocked players can be seen and messaged", () => {
  assert.equal(canSee(facts()), true)
  assert.equal(canMessage(facts()), true)
})

test("hidden profiles are invisible to everyone but their owner", () => {
  assert.equal(canSee(facts({ targetCommunityVisible: false })), false)
  assert.equal(
    canSee(facts({ targetId: "viewer", targetCommunityVisible: false })),
    true,
  )
})

test("blocks hide players in both directions", () => {
  assert.equal(canSee(facts({ viewerBlockedTarget: true })), false)
  assert.equal(canSee(facts({ targetBlockedViewer: true })), false)
  assert.equal(canMessage(facts({ targetBlockedViewer: true, viewerFollowsTarget: true })), false)
})

test("followers policy requires the viewer to follow the target", () => {
  assert.equal(canMessage(facts({ targetRequestPolicy: "followers" })), false)
  assert.equal(
    canMessage(facts({ targetRequestPolicy: "followers", viewerFollowsTarget: true })),
    true,
  )
  // The target following the viewer is not enough.
  assert.equal(
    canMessage(facts({ targetRequestPolicy: "followers", targetFollowsViewer: true })),
    false,
  )
})

test("rally partner policy requires a mutual follow", () => {
  const policy = { targetRequestPolicy: "rally_partners" }
  assert.equal(canMessage(facts({ ...policy, viewerFollowsTarget: true })), false)
  assert.equal(
    canMessage(facts({ ...policy, viewerFollowsTarget: true, targetFollowsViewer: true })),
    true,
  )
  assert.equal(isRallyPartner({ viewerFollowsTarget: true, targetFollowsViewer: true }), true)
})

test("players cannot message themselves", () => {
  assert.equal(canMessage(facts({ targetId: "viewer" })), false)
})

test("display names keep only the first name and last initial", () => {
  assert.equal(toCommunityDisplayName("Amara Kamau"), "Amara K.")
  assert.equal(toCommunityDisplayName("  James  Otieno Odhiambo "), "James O.")
  assert.equal(toCommunityDisplayName("Priya"), "Priya")
  assert.equal(toCommunityDisplayName("amara kamau"), "amara K.")
  assert.equal(toCommunityDisplayName("   "), "Player")
  assert.equal(toCommunityDisplayName(null), "Player")
})

test("rate limits allow the configured burst and reset after the window", () => {
  resetCommunityRateLimits()
  const start = 1_000_000

  for (let i = 0; i < 10; i += 1) {
    assert.equal(consumeCommunityRateLimit("availability", "u1", start), true)
  }
  assert.equal(consumeCommunityRateLimit("availability", "u1", start), false)
  assert.equal(consumeCommunityRateLimit("availability", "u2", start), true)
  assert.equal(consumeCommunityRateLimit("availability", "u1", start + 60 * 60_000), true)
})
