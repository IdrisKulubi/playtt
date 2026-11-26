// Tells a paid player their booking moved to another table (same venue, same
// time) because the original one couldn't record replays or keep score.

import { createElement } from "react"

import { and, eq } from "drizzle-orm"

import db from "@/db/drizzle"
import { bookings, locations, resources, user } from "@/db/schema"
import BookingTableChangedEmail, { bookingTableChangedSubject } from "@/emails/booking-table-changed-email"
import { siteUrl } from "@/emails/components"
import { sendPlayttEmail } from "@/server/email/send-email"
import { EVENT_TYPES, EVENT_VERSION } from "@/server/workers/events.mjs"

export async function consumeBookingTableChanged(row: {
  id?: string
  tenantId: string | null
  payload: Record<string, unknown>
}) {
  const tenantId = row.tenantId
  const bookingId = String(row.payload.bookingId ?? "")
  const fromResourceId = String(row.payload.fromResourceId ?? "")
  const toResourceId = String(row.payload.toResourceId ?? "")

  if (!tenantId || !bookingId || !toResourceId) {
    throw new Error("booking.table_changed.v1 event is missing booking identity.")
  }

  const [booking] = await db
    .select({
      email: user.email,
      name: user.name,
      venue: locations.name,
      table: resources.name,
      resourceId: bookings.resourceId,
      startTime: bookings.startTime,
      endTime: bookings.endTime,
      timezone: locations.timezone,
    })
    .from(bookings)
    .innerJoin(user, eq(user.id, bookings.userId))
    .innerJoin(locations, eq(locations.id, bookings.locationId))
    .innerJoin(resources, eq(resources.id, bookings.resourceId))
    .where(and(eq(bookings.tenantId, tenantId), eq(bookings.id, bookingId)))
    .limit(1)

  // Moved again since (or cancelled): a later event covers it.
  if (!booking || booking.resourceId !== toResourceId || !booking.email) return

  const [from] = fromResourceId
    ? await db.select({ name: resources.name }).from(resources).where(eq(resources.id, fromResourceId)).limit(1)
    : []

  const props = {
    name: booking.name ?? "",
    venueName: booking.venue,
    tableName: booking.table,
    previousTableName: from?.name,
    startTime: booking.startTime,
    endTime: booking.endTime,
    timeZone: booking.timezone ?? undefined,
    bookingUrl: siteUrl(`/bookings/${bookingId}`),
  }

  await sendPlayttEmail({
    kind: "table change",
    to: booking.email,
    subject: bookingTableChangedSubject(props),
    email: createElement(BookingTableChangedEmail, props),
    idempotencyKey: `booking-table-changed/${bookingId}/${toResourceId}`,
  })
}

export function createBookingTableChangedConsumers() {
  return {
    [EVENT_TYPES.BOOKING_TABLE_CHANGED_V1]: {
      eventVersion: EVENT_VERSION,
      consume: consumeBookingTableChanged,
    },
  }
}
