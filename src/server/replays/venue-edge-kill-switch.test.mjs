import { readFileSync } from "node:fs"
import { join } from "node:path"
import assert from "node:assert/strict"
import test from "node:test"

const repoRoot = join(import.meta.dirname, "..", "..", "..")

test("replay_edge kill switch leaves booking feature policy independent", () => {
  const featurePolicy = readFileSync(
    join(repoRoot, "src/server/replays/feature-policy.ts"),
    "utf8",
  )

  assert.match(featurePolicy, /replay_edge/)
  assert.match(featurePolicy, /isFeatureFlagEnabledForScope/)
  assert.doesNotMatch(featurePolicy, /booking.*disabled.*payment/i)
})

test("booking payment path does not require replay_edge", () => {
  const bookingService = readFileSync(
    join(repoRoot, "src/server/bookings/service.ts"),
    "utf8",
  )

  assert.doesNotMatch(bookingService, /replay_edge/)
})
