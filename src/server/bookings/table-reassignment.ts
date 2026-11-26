// Upcoming bookings on a table that can't run a full session (no camera or
// score buttons, or switched off) move to a ready table that is free at the
// same time. The player keeps their time and is emailed the new table. When no
// ready table is free, staff see the booking in admin to sort out by hand.
//
// Runs from the durable-work cycle (every minute), so a camera unassigned in
// admin is handled without anyone having to remember.

import { randomUUID } from "node:crypto"

import { and, asc, eq, gt, inArray, lt, not, notExists } from "drizzle-orm"

import db from "@/db/drizzle"
import {
  bookingStatusHistory,
  bookings,
  playSessions,
  resources,
  user,
} from "@/db/schema"
import { BOOKING_STATUSES_BLOCKING } from "@/server/bookings/constants"
import { isBookingOverlapConflict } from "@/server/bookings/database-errors"
import { freeResourceIds } from "@/server/bookings/scheduling.mjs"
import { bookableTableCondition } from "@/server/bookings/table-readiness"
import { retargetPlaySessionForBooking } from "@/server/sessions/play-sessions"
import { EVENT_TYPES, EVENT_VERSION } from "@/server/workers/events.mjs"
import { enqueueOutboxEvent } from "@/server/workers/outbox-repository"

/** Session statuses that mean play has begun; those bookings never move. */
const STARTED_SESSION_STATUSES = ["preparing", "active", "ending", "completed", "resetting"] as const

export interface StrandedBooking {
  bookingId: string
  tenantId: string
  locationId: string
  resourceId: string
  resourceName: string
  status: string
  firstName: string
  startTime: Date
  endTime: Date
}

function firstNameOf(name: string | null) {
  return (name ?? "").trim().split(/\s+/)[0] || "Player"
}

/** Upcoming bookings sitting on a table that isn't ready, oldest start first. */
export async function listStrandedBookings(filter: { tenantId?: string; locationId?: string } = {}) {
  const startedSession = db
    .select({ id: playSessions.id })
    .from(playSessions)
    .where(
      and(
        eq(playSessions.bookingId, bookings.id),
        inArray(playSessions.status, [...STARTED_SESSION_STATUSES]),
      ),
    )

  const rows = await db
    .select({
      bookingId: bookings.id,
      tenantId: bookings.tenantId,
      locationId: bookings.locationId,
      resourceId: bookings.resourceId,
      resourceName: resources.name,
      status: bookings.status,
      userName: user.name,
      startTime: bookings.startTime,
      endTime: bookings.endTime,
    })
    .from(bookings)
    .innerJoin(resources, eq(resources.id, bookings.resourceId))
    .innerJoin(user, eq(user.id, bookings.userId))
    .where(
      and(
        filter.tenantId ? eq(bookings.tenantId, filter.tenantId) : undefined,
        filter.locationId ? eq(bookings.locationId, filter.locationId) : undefined,
        inArray(bookings.status, [...BOOKING_STATUSES_BLOCKING]),
        gt(bookings.endTime, new Date()),
        not(and(eq(resources.isActive, true), bookableTableCondition())!),
        notExists(startedSession),
      ),
    )
    .orderBy(asc(bookings.startTime))

  return rows.map(
    (row): StrandedBooking => ({
      bookingId: row.bookingId,
      tenantId: row.tenantId,
      locationId: row.locationId,
      resourceId: row.resourceId,
      resourceName: row.resourceName,
      status: row.status,
      firstName: firstNameOf(row.userName),
      startTime: row.startTime,
      endTime: row.endTime,
    }),
  )
}

/** A ready table at the venue that is free for the whole booking, if any. */
async function findReadyFreeTable(booking: StrandedBooking) {
  const ready = await db
    .select({ id: resources.id })
    .from(resources)
    .where(
      and(
        eq(resources.tenantId, booking.tenantId),
        eq(resources.locationId, booking.locationId),
        eq(resources.isActive, true),
        bookableTableCondition(),
      ),
    )
    .orderBy(asc(resources.sortOrder), asc(resources.name))

  const readyIds = ready.map((row) => row.id)
  if (readyIds.length === 0) return null

  const busy = await db
    .select({ resourceId: bookings.resourceId, startTime: bookings.startTime, endTime: bookings.endTime })
    .from(bookings)
    .where(
      and(
        eq(bookings.tenantId, booking.tenantId),
        inArray(bookings.resourceId, readyIds),
        inArray(bookings.status, [...BOOKING_STATUSES_BLOCKING]),
        lt(bookings.startTime, booking.endTime),
        gt(bookings.endTime, booking.startTime),
      ),
    )

  const [freeId] = freeResourceIds({
    resourceIds: readyIds,
    bookings: busy,
    start: booking.startTime,
    end: booking.endTime,
  })
  return freeId ?? null
}

async function moveBooking(booking: StrandedBooking, toResourceId: string) {
  return db.transaction(async (tx) => {
    // Guarded on the old table so a concurrent edit or move wins cleanly.
    const [moved] = await tx
      .update(bookings)
      .set({ resourceId: toResourceId })
      .where(and(eq(bookings.id, booking.bookingId), eq(bookings.resourceId, booking.resourceId)))
      .returning({ id: bookings.id })

    if (!moved) return false

    await tx.insert(bookingStatusHistory).values({
      tenantId: booking.tenantId,
      bookingId: booking.bookingId,
      fromStatus: booking.status as (typeof BOOKING_STATUSES_BLOCKING)[number],
      toStatus: booking.status as (typeof BOOKING_STATUSES_BLOCKING)[number],
      reason: "table_not_ready",
      metadata: { fromResourceId: booking.resourceId, toResourceId, source: "table_reassignment" },
    })

    await retargetPlaySessionForBooking(tx, {
      tenantId: booking.tenantId,
      bookingId: booking.bookingId,
      resourceId: toResourceId,
      startTime: booking.startTime,
      endTime: booking.endTime,
    })

    // Paid players get told; an unpaid hold sees the table in its confirmation.
    if (booking.status === "confirmed") {
      await enqueueOutboxEvent(
        {
          tenantId: booking.tenantId,
          venueId: booking.locationId,
          resourceId: toResourceId,
          aggregateType: "booking",
          aggregateId: booking.bookingId,
          eventType: EVENT_TYPES.BOOKING_TABLE_CHANGED_V1,
          eventVersion: EVENT_VERSION,
          correlationId: `table_reassignment:${randomUUID()}`,
          payload: { bookingId: booking.bookingId, fromResourceId: booking.resourceId, toResourceId },
          idempotencyKey: `${EVENT_TYPES.BOOKING_TABLE_CHANGED_V1}:${booking.bookingId}:${toResourceId}`,
        },
        tx,
      )
    }

    return true
  })
}

/** Moves every stranded booking it can. Safe to run as often as you like. */
export async function reassignBookingsOffUnreadyTables() {
  const stranded = await listStrandedBookings()
  let moved = 0
  let stuck = 0

  for (const booking of stranded) {
    const toResourceId = await findReadyFreeTable(booking)
    if (!toResourceId) {
      stuck += 1
      continue
    }

    try {
      if (await moveBooking(booking, toResourceId)) moved += 1
    } catch (error) {
      // Someone booked that table a moment ago: try again next cycle.
      if (isBookingOverlapConflict(error)) {
        stuck += 1
        continue
      }
      throw error
    }
  }

  return { checked: stranded.length, moved, stuck }
}
