import assert from "node:assert/strict"
import test from "node:test"

import {
  ceilToStartStep,
  earliestBookableStart,
  isOnStartStep,
  isStartInPast,
  planBooking,
} from "./scheduling.mjs"

const at = (hhmm) => new Date(`2026-08-19T${hhmm}:00.000Z`)
const DAY = { searchStart: at("00:00"), searchEnd: new Date("2026-08-20T00:00:00.000Z") }

test("at 11:47 the soonest start is 11:50, and 11:30 is past", () => {
  const now = new Date("2026-08-19T11:47:20.000Z")
  assert.equal(earliestBookableStart(now).toISOString(), at("11:50").toISOString())
  assert.equal(isStartInPast(at("11:30"), now), true)
  assert.equal(isStartInPast(at("11:50"), now), false)
})

test("a start a few seconds behind now still counts (grace)", () => {
  const now = new Date("2026-08-19T11:50:30.000Z")
  assert.equal(isStartInPast(at("11:50"), now), false)
  assert.equal(earliestBookableStart(now).toISOString(), at("11:50").toISOString())
})

test("5-minute steps", () => {
  assert.equal(isOnStartStep(at("11:50")), true)
  assert.equal(isOnStartStep(new Date("2026-08-19T11:52:00.000Z")), false)
  assert.equal(ceilToStartStep(new Date("2026-08-19T11:51:00.000Z")).toISOString(), at("11:55").toISOString())
})

test("a free custom time is available on a free table", () => {
  const result = planBooking({
    resourceIds: ["a", "b"],
    bookings: [{ resourceId: "a", startTime: at("12:00"), endTime: at("13:00") }],
    start: at("11:50"),
    durationMinutes: 60,
    now: at("11:47"),
    ...DAY,
  })
  assert.equal(result.status, "available")
  assert.equal(result.resourceId, "b")
})

test("a clash suggests a shorter game, the time before and the time after", () => {
  // One table, booked 12:30-13:30. Asking for 12:10-13:10.
  const result = planBooking({
    resourceIds: ["a"],
    bookings: [{ resourceId: "a", startTime: at("12:30"), endTime: at("13:30") }],
    start: at("12:10"),
    durationMinutes: 60,
    now: at("11:00"),
    ...DAY,
  })
  assert.equal(result.status, "conflict")
  assert.equal(result.conflicts.length, 1)
  const byKind = Object.fromEntries(result.suggestions.map((s) => [s.kind, s]))
  assert.equal(byKind.earlier.startsAt.toISOString(), at("11:30").toISOString())
  assert.equal(byKind.earlier.shiftMinutes, -40)
  assert.equal(byKind.later.startsAt.toISOString(), at("13:30").toISOString())
  // Only 20 minutes free from 12:10, so no shorter option fits (min 30).
  assert.equal(byKind.shorter, undefined)
  // Closest first.
  assert.equal(result.suggestions[0].kind, "earlier")
})

test("shorter game offered when it fits before the next group", () => {
  const result = planBooking({
    resourceIds: ["a"],
    bookings: [{ resourceId: "a", startTime: at("13:00"), endTime: at("14:00") }],
    start: at("12:00"),
    durationMinutes: 120,
    now: at("11:00"),
    ...DAY,
  })
  const shorter = result.suggestions.find((s) => s.kind === "shorter")
  assert.equal(shorter.durationMinutes, 60)
  assert.equal(shorter.endsAt.toISOString(), at("13:00").toISOString())
})

test("suggestions never go into the past", () => {
  const result = planBooking({
    resourceIds: ["a"],
    bookings: [{ resourceId: "a", startTime: at("12:00"), endTime: at("13:00") }],
    start: at("12:00"),
    durationMinutes: 60,
    now: at("11:47"),
    ...DAY,
  })
  for (const suggestion of result.suggestions) {
    assert.ok(suggestion.startsAt >= at("11:50"), suggestion.startsAt.toISOString())
  }
  assert.equal(result.suggestions.find((s) => s.kind === "earlier"), undefined)
  assert.equal(result.suggestions[0].startsAt.toISOString(), at("13:00").toISOString())
})

test("picks whichever table frees up first", () => {
  const result = planBooking({
    resourceIds: ["a", "b"],
    bookings: [
      { resourceId: "a", startTime: at("12:00"), endTime: at("14:00") },
      { resourceId: "b", startTime: at("12:00"), endTime: at("12:45") },
    ],
    start: at("12:15"),
    durationMinutes: 60,
    now: at("11:00"),
    ...DAY,
  })
  const later = result.suggestions.find((s) => s.kind === "later")
  assert.equal(later.resourceId, "b")
  assert.equal(later.startsAt.toISOString(), at("12:45").toISOString())
})
