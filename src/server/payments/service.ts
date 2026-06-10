import { z } from "zod/v3"

import {
  kesToPaystackAmount,
  PAYSTACK_CURRENCY,
} from "@/server/payments/constants"
import { confirmBookingPayment } from "@/server/payments/confirm-booking"
import { PaymentServiceError } from "@/server/payments/errors"
import { formatPhoneForPaystack } from "@/server/payments/phone"
import {
  chargeMobileMoney,
  checkPaystackCharge,
  PaystackApiError,
  verifyPaystackTransaction,
} from "@/server/payments/paystack-client"
import {
  expireStalePendingBookings,
  findLatestPaymentForBooking,
  getBookingPaymentContext,
  insertPaymentRecord,
  markPaymentFailed,
} from "@/server/payments/repository"
import type { InitiatePaymentResult, PaymentStatusResult } from "@/server/payments/types"

const initiatePaymentBodySchema = z.object({
  phone: z.string().trim().optional(),
})

export async function runBookingExpirySweep() {
  return expireStalePendingBookings()
}

function assertBookingPayable(booking: {
  status: string
  paymentStatus: string
  expiresAt: Date | null
}) {
  if (booking.status === "confirmed" || booking.paymentStatus === "paid") {
    throw new PaymentServiceError(
      "BOOKING_ALREADY_PAID",
      "This booking is already paid.",
      409,
    )
  }

  if (booking.status === "expired") {
    throw new PaymentServiceError(
      "BOOKING_EXPIRED",
      "This booking hold has expired. Pick another slot.",
      410,
    )
  }

  if (booking.status === "cancelled") {
    throw new PaymentServiceError(
      "BOOKING_CANCELLED",
      "This booking was cancelled.",
      409,
    )
  }

  if (booking.status !== "pending" || booking.paymentStatus !== "unpaid") {
    throw new PaymentServiceError(
      "BOOKING_NOT_PAYABLE",
      "This booking cannot be paid right now.",
      409,
    )
  }

  if (booking.expiresAt && booking.expiresAt <= new Date()) {
    throw new PaymentServiceError(
      "BOOKING_EXPIRED",
      "This booking hold has expired. Pick another slot.",
      410,
    )
  }
}

function mapChargeDisplayText(status: string, displayText?: string) {
  if (displayText?.trim()) {
    return displayText.trim()
  }

  if (status === "pay_offline" || status === "pending") {
    return "Check your phone and enter your M-Pesa PIN to complete payment."
  }

  return "Processing your payment."
}

export async function initiateBookingPayment(input: {
  bookingId: string
  userId: string
  body: unknown
}): Promise<InitiatePaymentResult> {
  await runBookingExpirySweep()

  const parsed = initiatePaymentBodySchema.parse(input.body)
  const booking = await getBookingPaymentContext({
    bookingId: input.bookingId,
    userId: input.userId,
  })

  if (!booking) {
    throw new PaymentServiceError(
      "BOOKING_NOT_FOUND",
      "We could not find that booking.",
      404,
    )
  }

  assertBookingPayable(booking)

  const phoneSource = parsed.phone ?? booking.userPhone ?? ""
  const paystackPhone = formatPhoneForPaystack(phoneSource)

  if (!paystackPhone) {
    throw new PaymentServiceError(
      "PHONE_REQUIRED",
      "Add a valid Kenyan phone number before paying.",
      422,
    )
  }

  const latestPayment = await findLatestPaymentForBooking(booking.id)

  if (latestPayment?.status === "pending") {
    try {
      const charge = await checkPaystackCharge(latestPayment.providerReference)

      if (charge.status === "success") {
        await confirmBookingPayment({
          reference: latestPayment.providerReference,
          transaction: await verifyPaystackTransaction(latestPayment.providerReference),
          source: "verify",
        })
        throw new PaymentServiceError(
          "BOOKING_ALREADY_PAID",
          "This booking is already paid.",
          409,
        )
      }

      if (charge.status === "pay_offline" || charge.status === "pending") {
        return {
          reference: latestPayment.providerReference,
          status: charge.status,
          displayText: mapChargeDisplayText(charge.status, charge.display_text),
          expiresAt: booking.expiresAt?.toISOString() ?? null,
          bookingId: booking.id,
        }
      }

      if (charge.status === "failed" || charge.status === "timeout") {
        await markPaymentFailed({
          paymentId: latestPayment.id,
          rawPayload: charge as unknown as Record<string, unknown>,
        })
      }
    } catch (error) {
      if (error instanceof PaymentServiceError) {
        throw error
      }
    }
  }

  const amount = kesToPaystackAmount(booking.totalAmount)

  let charge

  try {
    charge = await chargeMobileMoney({
      email: booking.userEmail,
      amount,
      currency: PAYSTACK_CURRENCY,
      phone: paystackPhone,
      metadata: {
        bookingId: booking.id,
        userId: booking.userId,
      },
    })
  } catch (error) {
    const message =
      error instanceof PaystackApiError
        ? error.message
        : "Could not start M-Pesa payment."

    throw new PaymentServiceError("PAYMENT_INIT_FAILED", message, 502)
  }

  await insertPaymentRecord({
    bookingId: booking.id,
    locationId: booking.locationId,
    userId: booking.userId,
    providerReference: charge.reference,
    amount: booking.totalAmount,
    currency: booking.currency,
    rawPayload: charge as unknown as Record<string, unknown>,
  })

  if (charge.status === "failed" || charge.status === "timeout") {
    throw new PaymentServiceError(
      "PAYMENT_INIT_FAILED",
      charge.message ?? "M-Pesa payment could not be started.",
      502,
    )
  }

  return {
    reference: charge.reference,
    status: charge.status,
    displayText: mapChargeDisplayText(charge.status, charge.display_text),
    expiresAt: booking.expiresAt?.toISOString() ?? null,
    bookingId: booking.id,
  }
}

export async function getBookingPaymentStatus(input: {
  bookingId: string
  userId: string
}): Promise<PaymentStatusResult> {
  await runBookingExpirySweep()

  const booking = await getBookingPaymentContext({
    bookingId: input.bookingId,
    userId: input.userId,
  })

  if (!booking) {
    throw new PaymentServiceError(
      "BOOKING_NOT_FOUND",
      "We could not find that booking.",
      404,
    )
  }

  const latestPayment = await findLatestPaymentForBooking(booking.id)

  if (
    booking.status === "pending" &&
    booking.paymentStatus === "unpaid" &&
    latestPayment?.providerReference
  ) {
    try {
      const transaction = await verifyPaystackTransaction(
        latestPayment.providerReference,
      )

      if (transaction.status === "success") {
        await confirmBookingPayment({
          reference: latestPayment.providerReference,
          providerEventId: String(transaction.id),
          transaction,
          source: "verify",
        })

        return {
          bookingId: booking.id,
          bookingStatus: "confirmed",
          paymentStatus: "paid",
          reference: latestPayment.providerReference,
          providerStatus: transaction.status,
          displayText: null,
          expiresAt: booking.expiresAt?.toISOString() ?? null,
        }
      }
    } catch {
      // Fall through to current booking state.
    }
  }

  return {
    bookingId: booking.id,
    bookingStatus: booking.status,
    paymentStatus: booking.paymentStatus,
    reference: latestPayment?.providerReference ?? null,
    providerStatus: latestPayment?.status ?? null,
    displayText: null,
    expiresAt: booking.expiresAt?.toISOString() ?? null,
  }
}

export async function handlePaystackWebhookEvent(input: {
  event: string
  data: {
    id: number
    status: string
    reference: string
    amount: number
    currency: string
    paid_at?: string | null
    gateway_response?: string | null
    metadata?: Record<string, unknown> | string | null
  }
}) {
  if (input.event !== "charge.success") {
    return { handled: false }
  }

  const result = await confirmBookingPayment({
    reference: input.data.reference,
    providerEventId: String(input.data.id),
    transaction: input.data,
    source: "webhook",
  })

  return { handled: true, result }
}
