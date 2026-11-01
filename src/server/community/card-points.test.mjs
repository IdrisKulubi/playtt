import assert from "node:assert/strict"
import test from "node:test"

import {
  CARD_TIER_LADDER,
  cardPoints,
  cardProgress,
  cardRatingFromPoints,
  nextTierFor,
  tierForPoints,
} from "./card-points.ts"

test("points weight wins, sessions, drills and kudos", () => {
  assert.equal(cardPoints({ wins: 2, sessions: 3, drills: 1, kudos: 4 }), 2 * 25 + 3 * 10 + 15 + 4 * 5)
  assert.equal(cardPoints({ wins: 0, sessions: 0, drills: 0, kudos: 0 }), 0)
})

test("rating starts at 40, rises monotonically and caps at 99", () => {
  assert.equal(cardRatingFromPoints(0), 40)
  assert.equal(cardRatingFromPoints(-50), 40)
  let previous = 40
  for (let points = 0; points <= 20000; points += 250) {
    const rating = cardRatingFromPoints(points)
    assert.ok(rating >= previous, `rating dropped at ${points}`)
    previous = rating
  }
  assert.equal(cardRatingFromPoints(1_000_000), 99)
})

test("tiers climb blue → purple → pink → gold at the ladder thresholds", () => {
  assert.equal(tierForPoints(0), "blue")
  assert.equal(tierForPoints(599), "blue")
  assert.equal(tierForPoints(600), "purple")
  assert.equal(tierForPoints(1400), "pink")
  assert.equal(tierForPoints(2499), "pink")
  assert.equal(tierForPoints(2500), "gold")
  assert.deepEqual(
    CARD_TIER_LADDER.map((step) => step.tier),
    ["blue", "purple", "pink", "gold"],
  )
})

test("next tier is reported until gold", () => {
  assert.deepEqual(nextTierFor(0), { tier: "purple", minPoints: 600 })
  assert.deepEqual(nextTierFor(1500), { tier: "gold", minPoints: 2500 })
  assert.equal(nextTierFor(2500), null)
})

test("progress bundles points, rating, tier and the next threshold", () => {
  const progress = cardProgress({ wins: 20, sessions: 10, drills: 0, kudos: 0 })
  assert.equal(progress.points, 600)
  assert.equal(progress.tier, "purple")
  assert.equal(progress.nextTier, "pink")
  assert.equal(progress.nextTierPoints, 1400)
  assert.equal(progress.rating, cardRatingFromPoints(600))
})
