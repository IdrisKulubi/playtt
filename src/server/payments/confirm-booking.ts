import { and, eq, ne } from "drizzle-orm"

import db from "@/db/drizzle"
import { bookingStatusHistory, bookings, payments } from "@/db/schema"
import { kesToPaystackAmount } from "@/server/payments/constants"
import { sendBookingConfirmationEmail } from "@/server/payments/confirmation-email"
import {
  findPaymentByReference,
  getBookingPaymentContextByReference,
} from "@/server/payments/repository"
import type { PaystackTransactionData } from "@/server/payments/types"

function mapPaystackChannelToPaymentMethod(
  channel: string | null | undefined,
): "card" | "mpesa" {
  if (channel === "mobile_money") {
    return "mpesa"
  }

  return "card"
}

export type ConfirmBookingPaymentInput = {
  reference: string
  providerEventId?: string | null
  transaction: PaystackTransactionData
  source: "webhook" | "verify"
}

export async function confirmBookingPayment(input: ConfirmBookingPaymentInput) {
  const existingPayment = await findPaymentByReference(input.reference)

  if (!existingPayment) {
    return { confirmed: false, reason: "payment_not_found" as const }
  }

  if (existingPayment.status === "paid") {
    return { confirmed: true, reason: "already_confirmed" as const }
  }

  const bookingContext = await getBookingPaymentContextByReference(input.reference)

  if (!bookingContext) {
    return { confirmed: false, reason: "booking_not_found" as const }
  }

  if (bookingContext.status === "confirmed" && bookingContext.paymentStatus === "paid") {
    return { confirmed: true, reason: "already_confirmed" as const }
  }

  const expectedAmount = kesToPaystackAmount(bookingContext.totalAmount)

  if (
    input.transaction.amount !== expectedAmount ||
    input.transaction.currency !== bookingContext.currency
  ) {
    return { confirmed: false, reason: "amount_mismatch" as const }
  }

  if (input.transaction.status !== "success") {
    return { confirmed: false, reason: "not_successful" as const }
  }

  const paidAt = input.transaction.paid_at
    ? new Date(input.transaction.paid_at)
    : new Date()

  const paymentMethod = mapPaystackChannelToPaymentMethod(input.transaction.channel)

  const transition = await db.transaction(async (tx) => {
    const [confirmedBooking] = await tx
      .update(bookings)
      .set({
        paymentStatus: "paid",
        status: "confirmed",
        confirmedAt: paidAt,
      })
      .where(
        and(
          eq(bookings.id, bookingContext.id),
          eq(bookings.status, "pending"),
          eq(bookings.paymentStatus, "unpaid"),
        ),
      )
      .returning({ id: bookings.id })

    if (!confirmedBooking) {
      const [currentBooking] = await tx
        .select({
          status: bookings.status,
          paymentStatus: bookings.paymentStatus,
        })
        .from(bookings)
        .where(eq(bookings.id, bookingContext.id))
        .limit(1)

      if (
        currentBooking?.status === "confirmed" &&
        currentBooking.paymentStatus === "paid"
      ) {
        return "already_confirmed" as const
      }

      return "state_changed" as const
    }

    await tx
      .update(payments)
      .set({
        status: "paid",
        paidAt,
        paymentMethod,
        providerEventId: input.providerEventId ?? existingPayment.providerEventId,
        rawPayload: input.transaction as unknown as Record<string, unknown>,
      })
      .where(
        and(eq(payments.id, existingPayment.id), ne(payments.status, "paid")),
      )

    await tx.insert(bookingStatusHistory).values({
      bookingId: bookingContext.id,
      fromStatus: "pending",
      toStatus: "confirmed",
      reason: "payment_confirmed",
      metadata: {
        source: input.source,
        reference: input.reference,
      },
    })

    return "confirmed" as const
  })

  if (transition === "already_confirmed") {
    return { confirmed: true, reason: "already_confirmed" as const }
  }

  if (transition === "state_changed") {
    return { confirmed: false, reason: "booking_state_changed" as const }
  }

  void sendBookingConfirmationEmail({
    email: bookingContext.userEmail,
    name: bookingContext.userName,
    locationName: bookingContext.locationName,
    resourceName: bookingContext.resourceName,
    startTime: bookingContext.startTime,
    endTime: bookingContext.endTime,
    totalAmount: bookingContext.totalAmount,
    currency: bookingContext.currency,
  }).catch((error) => {
    console.error("[BOOKING EMAIL] Failed to send confirmation:", error)
  })

  return { confirmed: true, reason: "confirmed" as const }
}
