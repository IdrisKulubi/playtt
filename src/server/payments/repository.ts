import { and, desc, eq, isNotNull, lt } from "drizzle-orm"

import db from "@/db/drizzle"
import {
  bookingStatusHistory,
  bookings,
  locations,
  payments,
  resources,
  user,
} from "@/db/schema"
import type { BookingPaymentContext } from "@/server/payments/types"

export async function getBookingPaymentContext(input: {
  bookingId: string
  userId: string
}): Promise<BookingPaymentContext | null> {
  const [row] = await db
    .select({
      id: bookings.id,
      userId: bookings.userId,
      locationId: bookings.locationId,
      status: bookings.status,
      paymentStatus: bookings.paymentStatus,
      totalAmount: bookings.totalAmount,
      currency: bookings.currency,
      expiresAt: bookings.expiresAt,
      userEmail: user.email,
      userPhone: user.phone,
      userName: user.name,
      locationName: locations.name,
      resourceName: resources.name,
      startTime: bookings.startTime,
      endTime: bookings.endTime,
    })
    .from(bookings)
    .innerJoin(user, eq(bookings.userId, user.id))
    .innerJoin(locations, eq(bookings.locationId, locations.id))
    .innerJoin(resources, eq(bookings.resourceId, resources.id))
    .where(and(eq(bookings.id, input.bookingId), eq(bookings.userId, input.userId)))
    .limit(1)

  return row ?? null
}

export async function getBookingPaymentContextByReference(
  reference: string,
): Promise<BookingPaymentContext | null> {
  const [row] = await db
    .select({
      id: bookings.id,
      userId: bookings.userId,
      locationId: bookings.locationId,
      status: bookings.status,
      paymentStatus: bookings.paymentStatus,
      totalAmount: bookings.totalAmount,
      currency: bookings.currency,
      expiresAt: bookings.expiresAt,
      userEmail: user.email,
      userPhone: user.phone,
      userName: user.name,
      locationName: locations.name,
      resourceName: resources.name,
      startTime: bookings.startTime,
      endTime: bookings.endTime,
    })
    .from(payments)
    .innerJoin(bookings, eq(payments.bookingId, bookings.id))
    .innerJoin(user, eq(bookings.userId, user.id))
    .innerJoin(locations, eq(bookings.locationId, locations.id))
    .innerJoin(resources, eq(bookings.resourceId, resources.id))
    .where(
      and(eq(payments.provider, "paystack"), eq(payments.providerReference, reference)),
    )
    .limit(1)

  return row ?? null
}

export async function findLatestPaymentForBooking(bookingId: string) {
  const [row] = await db
    .select()
    .from(payments)
    .where(eq(payments.bookingId, bookingId))
    .orderBy(desc(payments.createdAt))
    .limit(1)

  return row ?? null
}

export async function findPaymentByReference(reference: string) {
  const [row] = await db
    .select()
    .from(payments)
    .where(
      and(eq(payments.provider, "paystack"), eq(payments.providerReference, reference)),
    )
    .limit(1)

  return row ?? null
}

export async function insertPaymentRecord(input: {
  bookingId: string
  locationId: string
  userId: string
  providerReference: string
  amount: string
  currency: string
  paymentMethod?: "mpesa" | "card"
  rawPayload: Record<string, unknown>
}) {
  const [created] = await db
    .insert(payments)
    .values({
      bookingId: input.bookingId,
      locationId: input.locationId,
      userId: input.userId,
      provider: "paystack",
      providerReference: input.providerReference,
      amount: input.amount,
      currency: input.currency,
      status: "pending",
      paymentMethod: input.paymentMethod ?? "mpesa",
      rawPayload: input.rawPayload,
    })
    .returning()

  return created
}

export async function markPaymentFailed(input: {
  paymentId: string
  rawPayload?: Record<string, unknown>
}) {
  await db
    .update(payments)
    .set({
      status: "failed",
      rawPayload: input.rawPayload,
    })
    .where(and(eq(payments.id, input.paymentId), eq(payments.status, "pending")))
}

export async function expireStalePendingBookings() {
  const now = new Date()

  return db.transaction(async (tx) => {
    const expiredBookings = await tx
      .update(bookings)
      .set({ status: "expired" })
      .where(
        and(
          eq(bookings.status, "pending"),
          eq(bookings.paymentStatus, "unpaid"),
          isNotNull(bookings.expiresAt),
          lt(bookings.expiresAt, now),
        ),
      )
      .returning({ id: bookings.id })

    if (expiredBookings.length > 0) {
      await tx.insert(bookingStatusHistory).values(
        expiredBookings.map((booking) => ({
          bookingId: booking.id,
          fromStatus: "pending" as const,
          toStatus: "expired" as const,
          reason: "payment_window_expired",
          metadata: { source: "expire_stale_pending_bookings" },
        })),
      )
    }

    return expiredBookings.length
  })
}

export async function cancelUnpaidBooking(input: {
  bookingId: string
  userId: string
}) {
  return db.transaction(async (tx) => {
    const now = new Date()

    const [cancelledBooking] = await tx
      .update(bookings)
      .set({
        status: "cancelled",
        cancelledAt: now,
      })
      .where(
        and(
          eq(bookings.id, input.bookingId),
          eq(bookings.userId, input.userId),
          eq(bookings.status, "pending"),
          eq(bookings.paymentStatus, "unpaid"),
        ),
      )
      .returning({
        id: bookings.id,
        status: bookings.status,
        paymentStatus: bookings.paymentStatus,
      })

    if (!cancelledBooking) {
      const [currentBooking] = await tx
        .select({
          id: bookings.id,
          status: bookings.status,
          paymentStatus: bookings.paymentStatus,
        })
        .from(bookings)
        .where(
          and(eq(bookings.id, input.bookingId), eq(bookings.userId, input.userId)),
        )
        .limit(1)

      return currentBooking ?? null
    }

    await tx.insert(bookingStatusHistory).values({
      bookingId: input.bookingId,
      fromStatus: "pending",
      toStatus: "cancelled",
      reason: "user_cancelled",
      metadata: { source: "api_bookings_cancel" },
    })

    return {
      id: cancelledBooking.id,
      status: cancelledBooking.status,
      paymentStatus: cancelledBooking.paymentStatus,
    }
  })
}
