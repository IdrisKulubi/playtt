import assert from "node:assert/strict"
import test from "node:test"

import {
  cardRating,
  cardRatingFor,
  decideGroupJoin,
  generateInviteCode,
  headToHead,
  isInForm,
  kFactor,
  matchScore,
  normalizeInviteCode,
  rateMatch,
  tierFromCardRating,
  winRate,
} from "./rating-rules.ts"

test("K is 32 for a player's first 10 matches, then 16", () => {
  assert.equal(kFactor(0), 32)
  assert.equal(kFactor(9), 32)
  assert.equal(kFactor(10), 16)
})

test("equal new players move 16 points each way", () => {
  const result = rateMatch({ rating: 1000, ratedMatches: 0 }, { rating: 1000, ratedMatches: 0 }, 1)
  assert.deepEqual(result.a, { rating: 1016, ratedMatches: 1, delta: 16 })
  assert.deepEqual(result.b, { rating: 984, ratedMatches: 1, delta: -16 })
})

test("an upset moves more than an expected win, and each side uses its own K", () => {
  const upset = rateMatch({ rating: 900, ratedMatches: 20 }, { rating: 1200, ratedMatches: 3 }, 1)
  assert.ok(upset.a.delta > 8, `underdog gains a lot (${upset.a.delta})`)
  assert.ok(upset.b.delta < -16, `new favourite drops by more (${upset.b.delta})`)
  const level = rateMatch({ rating: 1000, ratedMatches: 0 }, { rating: 1000, ratedMatches: 0 }, 0.5)
  assert.equal(level.a.delta, 0)
})

test("games decide the match score", () => {
  assert.equal(matchScore(3, 1), 1)
  assert.equal(matchScore(0, 3), 0)
  assert.equal(matchScore(2, 2), 0.5)
})

test("card rating maps Elo to 40–99 and only shows after 5 rated matches", () => {
  assert.equal(cardRating(1000), 67)
  assert.equal(cardRating(400), 40)
  assert.equal(cardRating(2000), 99)
  assert.equal(cardRatingFor({ rating: 1200, ratedMatches: 4 }), null)
  assert.equal(cardRatingFor({ rating: 1200, ratedMatches: 5 }), 80)
  assert.equal(cardRatingFor(null), null)
})

test("rated tiers: Rookie < 60, Club 60–79, Elite 80+", () => {
  assert.equal(tierFromCardRating(59), "rookie")
  assert.equal(tierFromCardRating(60), "club")
  assert.equal(tierFromCardRating(79), "club")
  assert.equal(tierFromCardRating(80), "elite")
})

test("WIN% waits for 5 recorded matches; In form needs the last 3 wins", () => {
  const at = (day, won) => ({ won, playedAt: new Date(Date.UTC(2026, 9, day)) })
  assert.equal(winRate([at(1, true), at(2, true)]), null)
  assert.equal(winRate([at(1, true), at(2, false), at(3, true), at(4, true), at(5, null)]), 75)
  assert.equal(isInForm([at(1, false), at(2, true), at(3, true), at(4, true)]), true)
  assert.equal(isInForm([at(1, true), at(2, true), at(3, true), at(4, false)]), false)
  assert.equal(isInForm([at(1, true), at(2, true)]), false)
})

test("head-to-head counts wins and losses, newest first", () => {
  const match = (id, day, mine, theirs) => ({ matchId: id, playedAt: new Date(Date.UTC(2026, 9, day)), myGames: mine, theirGames: theirs })
  const h2h = headToHead([match("m1", 1, 3, 1), match("m2", 5, 1, 3), match("m3", 3, 3, 2)])
  assert.equal(h2h.wins, 2)
  assert.equal(h2h.losses, 1)
  assert.equal(h2h.lastPlayedAt, "2026-10-05T00:00:00.000Z")
  assert.deepEqual(h2h.recent.map((entry) => entry.result), ["loss", "win", "win"])
})

test("invite codes are 8 unambiguous characters and normalise user input", () => {
  let i = 0
  const code = generateInviteCode((max) => (i++ * 7) % max)
  assert.match(code, /^[A-HJ-NP-Z2-9]{8}$/)
  assert.equal(normalizeInviteCode(` ${code.toLowerCase().slice(0, 4)}-${code.slice(4)} `), code)
  assert.equal(normalizeInviteCode("ABC10OIL"), null)
  assert.equal(normalizeInviteCode("short"), null)
})

test("groups cap members and stay open to existing members", () => {
  assert.deepEqual(decideGroupJoin({ activeMembers: 3, maxMembers: 4, alreadyMember: false, closed: false }), { ok: true })
  assert.deepEqual(decideGroupJoin({ activeMembers: 4, maxMembers: 4, alreadyMember: false, closed: false }), { ok: false, reason: "FULL" })
  assert.deepEqual(decideGroupJoin({ activeMembers: 4, maxMembers: 4, alreadyMember: true, closed: false }), { ok: true })
  assert.deepEqual(decideGroupJoin({ activeMembers: 1, maxMembers: 4, alreadyMember: false, closed: true }), { ok: false, reason: "CLOSED" })
})
