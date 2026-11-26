import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"

import { planBooking } from "./scheduling.mjs"

const repoRoot = join(import.meta.dirname, "..", "..", "..")
const read = (path) => readFileSync(join(repoRoot, path), "utf8")
const at = (hhmm) => new Date(`2026-08-19T${hhmm}:00.000Z`)
const DAY = { searchStart: at("00:00"), searchEnd: new Date("2026-08-20T00:00:00.000Z") }

test("readiness needs score buttons and a camera", () => {
  const source = read("src/server/bookings/table-readiness.ts")
  assert.match(source, /role, "score_input"/)
  assert.match(source, /isNull\(deviceAssignments\.effectiveTo\)/)
  assert.match(source, /ne\(devices\.status, "revoked"\)/)
  assert.match(source, /eq\(replaySourceRoutes\.isEnabled, true\)/)
  assert.match(source, /isNull\(replayCameraSources\.retiredAt\)/)
})

test("every booking query only offers ready tables", () => {
  const repository = read("src/server/bookings/repository.ts")
  // Bootstrap venue list, single table lookup, and the venue's table list.
  assert.equal(repository.match(/bookableTableCondition\(\)/g)?.length, 3)
})

test("booking creation picks from the venue's ready tables", () => {
  const service = read("src/server/bookings/service.ts")
  const create = service.slice(service.indexOf("export async function createPendingBooking"))
  assert.match(create, /listActiveResourcesByLocation/)
  assert.match(create, /freeIds\.includes\(parsed\.resourceId\)/)
})

test("one ready table booked 12:30–13:30: a 12:50 request is refused and 13:30 is offered", () => {
  // Table 2 has no camera, so only Table 1 is passed in as bookable.
  const result = planBooking({
    resourceIds: ["table-1"],
    bookings: [{ resourceId: "table-1", startTime: at("12:30"), endTime: at("13:30") }],
    start: at("12:50"),
    durationMinutes: 60,
    now: at("09:00"),
    ...DAY,
  })

  assert.equal(result.status, "conflict")
  const later = result.suggestions.find((suggestion) => suggestion.kind === "later")
  assert.equal(later?.startsAt.toISOString(), at("13:30").toISOString())
  assert.equal(later?.resourceId, "table-1")
})

test("two ready tables: the second one takes the overlapping time", () => {
  const result = planBooking({
    resourceIds: ["table-1", "table-2"],
    bookings: [{ resourceId: "table-1", startTime: at("12:30"), endTime: at("13:30") }],
    start: at("12:50"),
    durationMinutes: 60,
    now: at("09:00"),
    ...DAY,
  })

  assert.equal(result.status, "available")
  assert.equal(result.resourceId, "table-2")
})

test("stranded bookings move off unready tables, never once play has started", () => {
  const source = read("src/server/bookings/table-reassignment.ts")
  assert.match(source, /not\(and\(eq\(resources\.isActive, true\), bookableTableCondition\(\)\)!\)/)
  assert.match(source, /notExists\(startedSession\)/)
  assert.match(source, /"preparing", "active", "ending", "completed", "resetting"/)
  // Guarded on the old table, so a concurrent edit or move can't be overwritten.
  assert.match(source, /eq\(bookings\.resourceId, booking\.resourceId\)/)
  assert.match(source, /retargetPlaySessionForBooking/)
  assert.match(source, /isBookingOverlapConflict/)
})

test("only paid players get the table-change email", () => {
  const source = read("src/server/bookings/table-reassignment.ts")
  const move = source.slice(source.indexOf("async function moveBooking"))
  assert.match(move, /if \(booking\.status === "confirmed"\) \{\s+await enqueueOutboxEvent/)
  assert.match(read("src/server/bookings/table-change-email.ts"), /booking\.resourceId !== toResourceId/)
})

test("the minute-by-minute worker moves bookings and sends the email", () => {
  const worker = read("src/server/workers/run-durable-work.ts")
  assert.match(worker, /reassignBookingsOffUnreadyTables\(\)/)
  assert.match(worker, /createBookingTableChangedConsumers\(\)/)
  assert.ok(
    worker.indexOf("reassignBookingsOffUnreadyTables()") < worker.indexOf("reconcilePlaySessionLifecycle()"),
    "tables move before sessions are scheduled",
  )
})

test("editing a booking keeps its play session on the new table and time", () => {
  const source = read("src/server/bookings/modifications/repository.ts")
  assert.match(source, /retargetPlaySessionForBooking\(tx, \{[\s\S]*resourceId: after\.resourceId/)
})
