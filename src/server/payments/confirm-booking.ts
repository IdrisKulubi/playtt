import { eq } from "drizzle-orm"

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

  await db.transaction(async (tx) => {
    await tx
      .update(payments)
      .set({
        status: "paid",
        paidAt,
        paymentMethod,
        providerEventId: input.providerEventId ?? existingPayment.providerEventId,
        rawPayload: input.transaction as unknown as Record<string, unknown>,
      })
      .where(eq(payments.id, existingPayment.id))

    await tx
      .update(bookings)
      .set({
        paymentStatus: "paid",
        status: "confirmed",
        confirmedAt: paidAt,
      })
      .where(eq(bookings.id, bookingContext.id))

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
  })

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
