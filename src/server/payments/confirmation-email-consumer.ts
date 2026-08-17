import { and, eq } from "drizzle-orm"

import db from "@/db/drizzle"
import {
  bookings,
  locations,
  notifications,
  resources,
  user,
} from "@/db/schema"
import { sendBookingConfirmationEmail } from "@/server/payments/confirmation-email"
import { deliverThenMarkSent } from "@/server/payments/notification-delivery.mjs"
import {
  EVENT_TYPES,
  EVENT_VERSION,
} from "@/server/workers/events.mjs"

type PaymentConfirmedOutboxRow = {
  tenantId: string | null
  payload: Record<string, unknown>
}

async function loadBookingEmailContext(
  tenantId: string,
  bookingId: string,
) {
  const [row] = await db
    .select({
      userEmail: user.email,
      userName: user.name,
      locationName: locations.name,
      resourceName: resources.name,
      startTime: bookings.startTime,
      endTime: bookings.endTime,
      totalAmount: bookings.totalAmount,
      currency: bookings.currency,
    })
    .from(bookings)
    .innerJoin(user, eq(bookings.userId, user.id))
    .innerJoin(locations, eq(bookings.locationId, locations.id))
    .innerJoin(resources, eq(bookings.resourceId, resources.id))
    .where(
      and(
        eq(bookings.tenantId, tenantId),
        eq(locations.tenantId, tenantId),
        eq(resources.tenantId, tenantId),
        eq(bookings.id, bookingId),
      ),
    )
    .limit(1)

  return row ?? null
}

export async function consumePaymentConfirmedEmail(
  row: PaymentConfirmedOutboxRow,
) {
  const tenantId = row.tenantId
  const bookingId = String(row.payload.bookingId ?? "")

  if (!tenantId || !bookingId) {
    throw new Error("payment.confirmed.v1 event is missing booking identity.")
  }

  const [pendingNotification] = await db
    .select({ id: notifications.id })
    .from(notifications)
    .where(
      and(
        eq(notifications.tenantId, tenantId),
        eq(notifications.bookingId, bookingId),
        eq(notifications.channel, "email"),
        eq(notifications.templateKey, "booking_confirmed"),
        eq(notifications.status, "pending"),
      ),
    )
    .limit(1)

  if (!pendingNotification) {
    return
  }

  const booking = await loadBookingEmailContext(tenantId, bookingId)

  if (!booking?.userEmail) {
    throw new Error(
      `Booking ${bookingId} is missing recipient context for confirmation email.`,
    )
  }

  await deliverThenMarkSent({
    idempotencyKey: `booking-confirmation/${pendingNotification.id}`,
    deliver: (idempotencyKey: string) =>
      sendBookingConfirmationEmail({
        email: booking.userEmail,
        name: booking.userName,
        locationName: booking.locationName,
        resourceName: booking.resourceName,
        startTime: booking.startTime,
        endTime: booking.endTime,
        totalAmount: String(booking.totalAmount),
        currency: booking.currency,
        idempotencyKey,
      }),
    markSent: () =>
      db
        .update(notifications)
        .set({
          status: "sent",
          sentAt: new Date(),
        })
        .where(
          and(
            eq(notifications.id, pendingNotification.id),
            eq(notifications.status, "pending"),
          ),
        ),
  })
}

export function createPaymentConfirmedEmailConsumers() {
  return {
    [EVENT_TYPES.PAYMENT_CONFIRMED_V1]: {
      eventVersion: EVENT_VERSION,
      consume: consumePaymentConfirmedEmail,
    },
  }
}
