// Tells a paid player their booking moved to another table (same venue, same
// time) because the original one couldn't record replays or keep score.

import { and, eq } from "drizzle-orm"
import { Resend } from "resend"

import db from "@/db/drizzle"
import { bookings, locations, resources, user } from "@/db/schema"
import { EVENT_TYPES, EVENT_VERSION } from "@/server/workers/events.mjs"

const resend = new Resend(process.env.RESEND_API_KEY ?? "re_placeholder")
const fromEmail = process.env.RESEND_FROM_EMAIL?.trim().toLowerCase() || "onboarding@resend.dev"

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`)
}

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

  if (!process.env.RESEND_API_KEY?.trim()) {
    throw new Error("Booking email provider is not configured.")
  }

  const [from] = fromResourceId
    ? await db.select({ name: resources.name }).from(resources).where(eq(resources.id, fromResourceId)).limit(1)
    : []

  const timeZone = booking.timezone || "Africa/Nairobi"
  const start = booking.startTime.toLocaleString("en-KE", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  })
  const end = booking.endTime.toLocaleTimeString("en-KE", { hour: "numeric", minute: "2-digit", timeZone })
  const firstName = (booking.name ?? "").trim().split(/\s+/)[0] || "there"

  const html = `
    <p>Hi ${escapeHtml(firstName)},</p>
    <p>Your PlayTT booking has moved to <strong>${escapeHtml(booking.table)}</strong>${
      from ? ` (it was ${escapeHtml(from.name)})` : ""
    }. Same venue, same time:</p>
    <p><strong>${escapeHtml(booking.venue)}</strong> · ${escapeHtml(booking.table)}</p>
    <p>${escapeHtml(start)} – ${escapeHtml(end)}</p>
    <p>We moved you so replays and the scoreboard work for your whole session. Nothing else changes.</p>
  `

  const result = await resend.emails.send(
    {
      from: fromEmail,
      to: booking.email,
      subject: `Your PlayTT booking is now on ${booking.table}`,
      html,
    },
    { idempotencyKey: `booking-table-changed/${bookingId}/${toResourceId}` },
  )

  if (result.error) {
    throw new Error("Booking email provider rejected the table change email.")
  }
}

export function createBookingTableChangedConsumers() {
  return {
    [EVENT_TYPES.BOOKING_TABLE_CHANGED_V1]: {
      eventVersion: EVENT_VERSION,
      consume: consumeBookingTableChanged,
    },
  }
}
