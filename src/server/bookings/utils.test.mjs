import assert from "node:assert/strict"
import test from "node:test"

import { buildDaySlots, getZonedHours, zonedWallTime } from "./day-slots.mjs"

const TIME_ZONE = "Africa/Nairobi"
const DATE_KEY = "2026-08-19"

test("buildDaySlots offers every 30-minute start across 24 hours", () => {
  const slots = buildDaySlots(DATE_KEY, 30, TIME_ZONE)

  assert.equal(slots.length, 48)
  assert.equal(slots[0]?.startsAt.toISOString(), "2026-08-18T21:00:00.000Z")
  assert.equal(slots.at(-1)?.startsAt.toISOString(), "2026-08-19T20:30:00.000Z")
  assert.equal(getZonedHours(slots[0].startsAt, TIME_ZONE), 0)
  assert.equal(getZonedHours(slots.at(-1).startsAt, TIME_ZONE), 23)
})

test("buildDaySlots allows a 60-minute session that starts at 11:30 PM", () => {
  const slots = buildDaySlots(DATE_KEY, 60, TIME_ZONE)
  const lateSlot = slots.at(-1)

  assert.equal(slots.length, 48)
  assert.equal(lateSlot?.startsAt.toISOString(), "2026-08-19T20:30:00.000Z")
  assert.equal(lateSlot?.endsAt.toISOString(), "2026-08-19T21:30:00.000Z")
  assert.equal(getZonedHours(lateSlot.startsAt, TIME_ZONE), 23)
})

test("Nairobi wall clock hours stay stable regardless of server timezone", () => {
  const peakStart = zonedWallTime(DATE_KEY, 18, 0, TIME_ZONE)
  const lateEvening = zonedWallTime(DATE_KEY, 22, 0, TIME_ZONE)

  assert.equal(peakStart.toISOString(), "2026-08-19T15:00:00.000Z")
  assert.equal(lateEvening.toISOString(), "2026-08-19T19:00:00.000Z")
  assert.equal(getZonedHours(peakStart, TIME_ZONE), 18)
  assert.equal(getZonedHours(lateEvening, TIME_ZONE), 22)
})
