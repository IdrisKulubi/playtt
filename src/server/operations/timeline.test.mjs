import { readFileSync } from "node:fs"
import { join } from "node:path"
import assert from "node:assert/strict"
import test from "node:test"

import {
  buildConfirmationCorrelationId,
  mergeTimelineEvents,
  normalizeBookingEvents,
  normalizePaymentEvents,
  sortTimelineEvents,
} from "./timeline-types.ts"

const operationsRoot = join(import.meta.dirname)
const repoRoot = join(import.meta.dirname, "..", "..", "..")

test("buildConfirmationCorrelationId follows payment confirmation convention", () => {
  assert.equal(
    buildConfirmationCorrelationId("book-123"),
    "confirm-booking:book-123",
  )
})

test("sortTimelineEvents orders by occurredAt then id", () => {
  const events = sortTimelineEvents([
    {
      id: "b",
      category: "booking",
      label: "Later",
      occurredAt: "2026-01-02T10:00:00.000Z",
      entityType: "booking",
      entityId: "1",
    },
    {
      id: "a",
      category: "payment",
      label: "Earlier",
      occurredAt: "2026-01-01T10:00:00.000Z",
      entityType: "payment",
      entityId: "1",
    },
  ])

  assert.equal(events[0]?.label, "Earlier")
  assert.equal(events[1]?.label, "Later")
})

test("mergeTimelineEvents deduplicates by event id", () => {
  const shared = {
    id: "payment:1:paid",
    category: "payment",
    label: "Payment confirmed",
    occurredAt: "2026-01-01T10:00:00.000Z",
    entityType: "payment",
    entityId: "1",
  }

  const merged = mergeTimelineEvents([shared], [shared])
  assert.equal(merged.length, 1)
})

test("booking and payment normalizers emit lifecycle timestamps", () => {
  const bookingEvents = normalizeBookingEvents({
    id: "book-1",
    status: "confirmed",
    paymentStatus: "paid",
    createdAt: "2026-01-01T09:00:00.000Z",
    confirmedAt: "2026-01-01T09:05:00.000Z",
  })

  assert.equal(bookingEvents.length, 2)

  const paymentEvents = normalizePaymentEvents([
    {
      id: "pay-1",
      status: "paid",
      providerReference: "ref-1",
      createdAt: "2026-01-01T09:01:00.000Z",
      paidAt: "2026-01-01T09:05:00.000Z",
    },
  ])

  assert.equal(paymentEvents.length, 2)
})

test("timeline repository scopes reads by tenant and booking", () => {
  const source = readFileSync(
    join(operationsRoot, "timeline-repository.ts"),
    "utf8",
  )

  assert.match(source, /eq\(bookings\.tenantId, context\.tenantId\)/)
  assert.match(source, /eq\(bookings\.id, bookingId\)/)
  assert.match(source, /eq\(payments\.tenantId, context\.tenantId\)/)
  assert.match(source, /eq\(playSessions\.tenantId, context\.tenantId\)/)
  assert.match(source, /eq\(replayRequests\.tenantId, context\.tenantId\)/)
  assert.match(source, /eq\(outboxEvents\.tenantId, context\.tenantId\)/)
  assert.match(source, /eq\(auditLogs\.tenantId, context\.tenantId\)/)
  assert.match(source, /eq\(deviceCommands\.tenantId, context\.tenantId\)/)
  assert.match(source, /eq\(mediaAssets\.tenantId, context\.tenantId\)/)
  assert.match(source, /eq\(sessionEvents\.tenantId, context\.tenantId\)/)
})

test("timeline service authorizes booking.read and admin routes expose booking timeline", () => {
  const service = readFileSync(
    join(operationsRoot, "timeline-service.ts"),
    "utf8",
  )
  const page = readFileSync(
    join(repoRoot, "src", "app", "admin", "bookings", "[id]", "page.tsx"),
    "utf8",
  )
  const table = readFileSync(
    join(repoRoot, "src", "components", "admin", "admin-overview-charts.tsx"),
    "utf8",
  )

  assert.match(service, /authorize\(context, "booking\.read"\)/)
  assert.match(page, /getBookingTimeline/)
  assert.match(page, /AdminBookingTimeline/)
  assert.match(table, /\/admin\/bookings\/\$\{booking\.id\}/)
})
