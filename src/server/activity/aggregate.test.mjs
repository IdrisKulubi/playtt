import test from "node:test"
import assert from "node:assert/strict"
import { activityRange, aggregateActivity } from "./aggregate.ts"
const row = (extra = {}) => ({
  id: "a",
  startTime: new Date("2026-02-28T21:00:00Z"),
  endTime: new Date("2026-02-28T22:00:00Z"),
  durationMinutes: 60,
  locationName: "Venue",
  resourceName: "Table 1",
  status: "completed",
  paymentStatus: "paid",
  currency: "KES",
  totalKes: 500,
  spendKes: 500,
  ...extra,
})
test("Nairobi calendar includes UTC previous evening, leap day and year rollover", () => {
  assert.equal(
    activityRange("day", "2026-03-01").start.toISOString(),
    "2026-02-28T21:00:00.000Z"
  )
  assert.equal(
    activityRange("month", "2024-02-29").end.toISOString(),
    "2024-02-29T21:00:00.000Z"
  )
  assert.equal(
    activityRange("month", "2026-01-15").previousStart.toISOString(),
    "2025-11-30T21:00:00.000Z"
  )
  assert.throws(() => activityRange("day", "2026-02-30"))
})
test("sessions exclude cancelled, unpaid pending and future confirmed; money remains separate", () => {
  const rows = [
    row(),
    row({ id: "cancel", status: "cancelled", spendKes: 200 }),
    row({ id: "pending", status: "pending", spendKes: 0 }),
    row({
      id: "future",
      status: "confirmed",
      endTime: new Date("2026-03-02T00:00:00Z"),
      spendKes: 400,
    }),
  ]
  const result = aggregateActivity(
    rows,
    "day",
    "2026-03-01",
    new Date("2026-03-01T10:00:00Z")
  )
  assert.equal(result.totals.sessions, 1)
  assert.equal(result.totals.minutes, 60)
  assert.equal(result.totals.cancelledSessions, 1)
  assert.equal(result.totals.spendKes, 1100)
  assert.equal(
    result.buckets.reduce((n, b) => n + b.sessions, 0),
    1
  )
  assert.equal(result.buckets.length, 24)
})
test("zero filled periods, previous comparisons and currency separation", () => {
  const result = aggregateActivity(
    [
      row({ startTime: new Date("2026-02-01T00:00:00Z") }),
      row({ currency: "USD", spendKes: 500 }),
    ],
    "month",
    "2026-03-01"
  )
  assert.equal(result.buckets.length, 31)
  assert.equal(result.totals.spendKes, 0)
  assert.equal(result.previous.totals.spendKes, 500)
  assert.equal(result.totals.sessions, 1)
  const empty = aggregateActivity([], "year", "2026-01-01")
  assert.equal(empty.buckets.length, 12)
  assert.equal(empty.totals.averageMinutes, 0)
})
