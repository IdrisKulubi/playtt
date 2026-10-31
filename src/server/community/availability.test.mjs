import assert from "node:assert/strict"
import test from "node:test"

import { isOpenNow, resolveAvailabilityWindow } from "./availability-window.ts"

const NAIROBI = "Africa/Nairobi" // UTC+3, no DST

// Wednesday 2026-10-28 14:30 Nairobi = 11:30Z
const WEDNESDAY_AFTERNOON = new Date("2026-10-28T11:30:00.000Z")

function range(window, now) {
  const result = resolveAvailabilityWindow(window, now, NAIROBI)
  assert.equal(result.ok, true)
  return {
    startsAt: result.range.startsAt.toISOString(),
    endsAt: result.range.endsAt.toISOString(),
  }
}

test("now lasts two hours from the current instant", () => {
  assert.deepEqual(range("now", WEDNESDAY_AFTERNOON), {
    startsAt: "2026-10-28T11:30:00.000Z",
    endsAt: "2026-10-28T13:30:00.000Z",
  })
})

test("today ends at local midnight in Nairobi", () => {
  assert.deepEqual(range("today", WEDNESDAY_AFTERNOON), {
    startsAt: "2026-10-28T11:30:00.000Z",
    endsAt: "2026-10-28T20:59:59.999Z",
  })
})

test("today uses the venue's local date just after midnight UTC", () => {
  // 00:30Z = 03:30 Nairobi on the 29th
  assert.deepEqual(range("today", new Date("2026-10-29T00:30:00.000Z")).endsAt, "2026-10-29T20:59:59.999Z")
})

test("tonight starts at 17:00 local when opened in the afternoon", () => {
  assert.deepEqual(range("tonight", WEDNESDAY_AFTERNOON), {
    startsAt: "2026-10-28T14:00:00.000Z",
    endsAt: "2026-10-28T20:00:00.000Z",
  })
})

test("tonight starts immediately when opened during the evening", () => {
  // 19:15 Nairobi
  const now = new Date("2026-10-28T16:15:00.000Z")
  assert.equal(range("tonight", now).startsAt, now.toISOString())
})

test("tonight is rejected after 23:00 local", () => {
  const result = resolveAvailabilityWindow("tonight", new Date("2026-10-28T20:30:00.000Z"), NAIROBI)
  assert.equal(result.ok, false)
  assert.equal(result.code, "WINDOW_PASSED")
})

test("weekend on a weekday covers the coming Saturday and Sunday", () => {
  assert.deepEqual(range("weekend", WEDNESDAY_AFTERNOON), {
    startsAt: "2026-10-30T21:00:00.000Z", // Sat 31 Oct 00:00 Nairobi
    endsAt: "2026-11-01T20:59:59.999Z", // Sun 1 Nov 23:59:59.999 Nairobi
  })
})

test("weekend on Saturday starts now and ends Sunday night", () => {
  const saturday = new Date("2026-10-31T09:00:00.000Z")
  assert.deepEqual(range("weekend", saturday), {
    startsAt: saturday.toISOString(),
    endsAt: "2026-11-01T20:59:59.999Z",
  })
})

test("weekend on Sunday ends the same night", () => {
  const sunday = new Date("2026-11-01T09:00:00.000Z")
  assert.equal(range("weekend", sunday).endsAt, "2026-11-01T20:59:59.999Z")
})

test("every window ends after it starts", () => {
  for (let hour = 0; hour < 24; hour += 1) {
    const now = new Date(Date.UTC(2026, 9, 28, hour, 5))
    for (const window of ["now", "today", "tonight", "weekend"]) {
      const result = resolveAvailabilityWindow(window, now, NAIROBI)
      if (result.ok) {
        assert.ok(result.range.endsAt > result.range.startsAt, `${window} at ${now.toISOString()}`)
      }
    }
  }
})

test("isOpenNow distinguishes current and upcoming windows", () => {
  const upcoming = resolveAvailabilityWindow("tonight", WEDNESDAY_AFTERNOON, NAIROBI)
  assert.equal(isOpenNow(upcoming.range, WEDNESDAY_AFTERNOON), false)
  assert.equal(isOpenNow(upcoming.range, new Date("2026-10-28T15:00:00.000Z")), true)
  assert.equal(isOpenNow(upcoming.range, new Date("2026-10-28T20:00:00.000Z")), false)
})
