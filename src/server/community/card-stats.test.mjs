import assert from "node:assert/strict"
import test from "node:test"

import { computeCardStats, groupCardStats, toCardStatWeeks, weeklyStreak } from "./card-stats.ts"

// Wednesday 2026-10-28 14:30 Nairobi; that week starts Monday 2026-10-26.
const NOW = new Date("2026-10-28T11:30:00.000Z")

function week(weekStart, sessions = 1, minutes = 60, userId = "u1") {
  return { userId, weekStart, sessions, minutes }
}

test("new players get dashes, never zeros", () => {
  assert.deepEqual(computeCardStats([], NOW), {
    matches: null,
    winRate: null,
    reliability: null,
    streakWeeks: null,
    kudos: null,
    hours: null,
  })
})

test("matches and hours add up across weeks", () => {
  const stats = computeCardStats([week("2026-10-26", 2, 120), week("2026-10-12", 1, 90)], NOW)
  assert.equal(stats.matches, 3)
  assert.equal(stats.hours, 4) // 210 min → 3.5 h → 4
})

test("a short session still shows at least one hour", () => {
  assert.equal(computeCardStats([week("2026-10-26", 1, 20)], NOW).hours, 1)
})

test("streak counts consecutive weeks including this one", () => {
  assert.equal(weeklyStreak(["2026-10-26", "2026-10-19", "2026-10-12", "2026-09-28"], NOW), 3)
})

test("streak survives a current week with no session yet", () => {
  assert.equal(weeklyStreak(["2026-10-19", "2026-10-12"], NOW), 2)
})

test("streak is broken by a missed full week", () => {
  assert.equal(weeklyStreak(["2026-10-12", "2026-10-05"], NOW), 0)
  assert.equal(computeCardStats([week("2026-10-12")], NOW).streakWeeks, null)
})

test("week boundaries use Nairobi time, not UTC", () => {
  // Sunday 23:30Z is already Monday 02:30 in Nairobi, so a new week.
  const mondayNairobi = new Date("2026-10-25T23:30:00.000Z")
  assert.equal(weeklyStreak(["2026-10-26"], mondayNairobi), 1)
})

test("grouping gives every requested user a stats object", () => {
  const stats = groupCardStats(["u1", "u2"], [week("2026-10-26", 4, 240, "u1")], NOW)
  assert.equal(stats.get("u1").matches, 4)
  assert.equal(stats.get("u2").matches, null)
})

test("sessions are deduped per booking and bucketed by Nairobi week", () => {
  const session = (bookingId, startTime, durationMinutes = 60) => ({
    userId: "u1",
    bookingId,
    startTime: new Date(startTime),
    durationMinutes,
  })
  const weeks = toCardStatWeeks([
    session("b1", "2026-10-27T15:00:00.000Z"),
    session("b1", "2026-10-27T15:00:00.000Z"), // same booking as owner + participant
    session("b2", "2026-10-25T22:00:00.000Z", 30), // Mon 01:00 Nairobi
    session("b3", "2026-10-20T15:00:00.000Z"),
  ])
  assert.deepEqual(
    weeks.sort((a, b) => a.weekStart.localeCompare(b.weekStart)),
    [
      { userId: "u1", weekStart: "2026-10-19", sessions: 1, minutes: 60 },
      { userId: "u1", weekStart: "2026-10-26", sessions: 2, minutes: 90 },
    ],
  )
})
