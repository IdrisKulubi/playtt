import assert from "node:assert/strict"
import test from "node:test"

import {
  computeReliability,
  decideJoin,
  kudosBadges,
  kudosWindow,
  reliabilityOutcome,
  topKudos,
} from "./social-rules.ts"
import { isRallyPartner } from "./visibility.ts"

const NOW = new Date("2026-10-28T12:00:00.000Z")
const HOUR = 60 * 60_000

function fact(overrides = {}) {
  const startTime = overrides.startTime ?? new Date(NOW.getTime() - 3 * HOUR)
  return {
    bookingId: "b1",
    role: "guest",
    bookingStatus: "completed",
    startTime,
    endTime: new Date(startTime.getTime() + HOUR),
    cancelledAt: null,
    leftAt: null,
    sessionStartedAt: startTime,
    excused: false,
    ...overrides,
  }
}

test("played sessions are kept, future ones aren't counted yet", () => {
  assert.equal(reliabilityOutcome(fact(), NOW), "kept")
  assert.equal(reliabilityOutcome(fact({ startTime: new Date(NOW.getTime() + HOUR), bookingStatus: "confirmed" }), NOW), "uncounted")
})

test("pulling out under 2 h before the start is a miss; earlier is not counted", () => {
  const startTime = new Date(NOW.getTime() + 5 * HOUR)
  assert.equal(reliabilityOutcome(fact({ startTime, leftAt: new Date(startTime.getTime() - HOUR) }), NOW), "missed")
  assert.equal(reliabilityOutcome(fact({ startTime, leftAt: new Date(startTime.getTime() - 3 * HOUR) }), NOW), "uncounted")
})

test("late host cancellation is the host's miss, not the guest's", () => {
  const startTime = new Date(NOW.getTime() + HOUR)
  const cancelled = { startTime, bookingStatus: "cancelled", cancelledAt: NOW }
  assert.equal(reliabilityOutcome(fact({ ...cancelled, role: "owner" }), NOW), "missed")
  assert.equal(reliabilityOutcome(fact({ ...cancelled, role: "guest" }), NOW), "uncounted")
})

test("a session that never went active is a no-show unless excused", () => {
  assert.equal(reliabilityOutcome(fact({ sessionStartedAt: null }), NOW), "missed")
  assert.equal(reliabilityOutcome(fact({ sessionStartedAt: null, excused: true }), NOW), "kept")
})

test("REL shows after 3 counted bookings; Reliable needs 90% over 5", () => {
  const kept = fact()
  const missed = fact({ sessionStartedAt: null })
  assert.equal(computeReliability([kept, kept], NOW).percent, null)
  assert.deepEqual(computeReliability([kept, kept, missed], NOW), { percent: 67, kept: 2, total: 3, reliableBadge: false })
  assert.equal(computeReliability([kept, kept, kept, kept, kept], NOW).reliableBadge, true)
  assert.equal(computeReliability([kept, kept, kept, kept, missed], NOW).reliableBadge, false)
})

test("kudos badges unlock at 10 of one type", () => {
  assert.deepEqual(kudosBadges({ great_rallies: 10, on_time: 12, fair_play: 9 }), ["rally_ace", "clockwork"])
  assert.deepEqual(topKudos({ fair_play: 2, great_rallies: 5, on_time: 2, good_coach: 1 }), [
    { type: "great_rallies", count: 5 },
    { type: "fair_play", count: 2 },
    { type: "on_time", count: 2 },
  ])
})

test("kudos open when the session ends and close 72 h later", () => {
  const endedAt = new Date(NOW.getTime() - HOUR)
  assert.equal(kudosWindow(new Date(NOW.getTime() + HOUR), NOW), "not_yet")
  assert.equal(kudosWindow(endedAt, NOW), "open")
  assert.equal(kudosWindow(new Date(NOW.getTime() - 73 * HOUR), NOW), "closed")
})

test("joining respects the booking's group size", () => {
  const base = {
    bookingStatus: "confirmed",
    startTime: new Date(NOW.getTime() + 2 * HOUR),
    groupSize: 2,
    activePartners: 1,
    alreadyJoined: false,
    now: NOW,
  }
  assert.deepEqual(decideJoin(base), { ok: true })
  assert.equal(decideJoin({ ...base, activePartners: 2 }).code, "BOOKING_FULL")
  assert.match(decideJoin({ ...base, groupSize: 1, activePartners: 0 }).reason, /for 1 player/)
  assert.equal(decideJoin({ ...base, startTime: NOW }).code, "BOOKING_NOT_JOINABLE")
  assert.equal(decideJoin({ ...base, bookingStatus: "pending" }).code, "BOOKING_NOT_JOINABLE")
  assert.deepEqual(decideJoin({ ...base, activePartners: 2, alreadyJoined: true }), { ok: true })
})

test("rally partners are mutual follows or players who shared a booking", () => {
  assert.equal(isRallyPartner({ viewerFollowsTarget: true, targetFollowsViewer: true }), true)
  assert.equal(isRallyPartner({ viewerFollowsTarget: true, targetFollowsViewer: false }), false)
  assert.equal(isRallyPartner({ viewerFollowsTarget: false, targetFollowsViewer: false, playedTogether: true }), true)
})
