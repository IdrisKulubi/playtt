import { z } from "zod/v3"

import {
  getPaymentCallbackUrl,
  kesToPaystackAmount,
  PAYSTACK_CURRENCY,
} from "@/server/payments/constants"
import { confirmBookingPayment } from "@/server/payments/confirm-booking"
import { PaymentServiceError } from "@/server/payments/errors"
import { formatPhoneForPaystack } from "@/server/payments/phone"
import {
  chargeMobileMoney,
  checkPaystackCharge,
  initializeCardTransaction,
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
import type {
  BookingPaymentContext,
  InitiatePaymentResult,
  PaymentMethodChoice,
  PaymentStatusResult,
} from "@/server/payments/types"

const initiatePaymentBodySchema = z.object({
  method: z.enum(["mpesa", "card"]).optional(),
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

function getAuthorizationUrlFromPayload(
  rawPayload: Record<string, unknown> | null | undefined,
) {
  if (!rawPayload) {
    return null
  }

  const url = rawPayload.authorization_url

  return typeof url === "string" && url.trim() ? url : null
}

async function tryConfirmFromVerify(reference: string) {
  const transaction = await verifyPaystackTransaction(reference)

  if (transaction.status === "success") {
    await confirmBookingPayment({
      reference,
      providerEventId: String(transaction.id),
      transaction,
      source: "verify",
    })
    throw new PaymentServiceError(
      "BOOKING_ALREADY_PAID",
      "This booking is already paid.",
      409,
    )
  }

  return transaction
}

function buildResult(input: {
  method: PaymentMethodChoice
  reference: string
  status: string
  displayText: string
  booking: BookingPaymentContext
  authorizationUrl?: string
}): InitiatePaymentResult {
  return {
    method: input.method,
    reference: input.reference,
    status: input.status,
    displayText: input.displayText,
    expiresAt: input.booking.expiresAt?.toISOString() ?? null,
    bookingId: input.booking.id,
    authorizationUrl: input.authorizationUrl,
  }
}

async function initiateMpesaPayment(
  booking: BookingPaymentContext,
  phone?: string,
): Promise<InitiatePaymentResult> {
  const phoneSource = phone ?? booking.userPhone ?? ""
  const paystackPhone = formatPhoneForPaystack(phoneSource)

  if (!paystackPhone) {
    throw new PaymentServiceError(
      "PHONE_REQUIRED",
      "Add a valid Kenyan phone number before paying.",
      422,
    )
  }

  const latestPayment = await findLatestPaymentForBooking(booking.id)

  if (
    latestPayment?.status === "pending" &&
    latestPayment.paymentMethod === "mpesa"
  ) {
    try {
      const charge = await checkPaystackCharge(latestPayment.providerReference)

      if (charge.status === "success") {
        await tryConfirmFromVerify(latestPayment.providerReference)
      }

      if (charge.status === "pay_offline" || charge.status === "pending") {
        return buildResult({
          method: "mpesa",
          reference: latestPayment.providerReference,
          status: charge.status,
          displayText: mapChargeDisplayText(charge.status, charge.display_text),
          booking,
        })
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
    paymentMethod: "mpesa",
    rawPayload: charge as unknown as Record<string, unknown>,
  })

  if (charge.status === "failed" || charge.status === "timeout") {
    throw new PaymentServiceError(
      "PAYMENT_INIT_FAILED",
      charge.message ?? "M-Pesa payment could not be started.",
      502,
    )
  }

  return buildResult({
    method: "mpesa",
    reference: charge.reference,
    status: charge.status,
    displayText: mapChargeDisplayText(charge.status, charge.display_text),
    booking,
  })
}

async function initiateCardPayment(
  booking: BookingPaymentContext,
): Promise<InitiatePaymentResult> {
  const latestPayment = await findLatestPaymentForBooking(booking.id)

  if (
    latestPayment?.status === "pending" &&
    latestPayment.paymentMethod === "card"
  ) {
    try {
      await tryConfirmFromVerify(latestPayment.providerReference)
    } catch (error) {
      if (error instanceof PaymentServiceError) {
        throw error
      }
    }

    const authorizationUrl = getAuthorizationUrlFromPayload(
      latestPayment.rawPayload as Record<string, unknown> | null,
    )

    if (authorizationUrl) {
      return buildResult({
        method: "card",
        reference: latestPayment.providerReference,
        status: "pending",
        displayText: "Complete payment in the secure checkout.",
        booking,
        authorizationUrl,
      })
    }
  }

  const amount = kesToPaystackAmount(booking.totalAmount)

  let initialized

  try {
    initialized = await initializeCardTransaction({
      email: booking.userEmail,
      amount,
      currency: PAYSTACK_CURRENCY,
      callbackUrl: getPaymentCallbackUrl(),
      metadata: {
        bookingId: booking.id,
        userId: booking.userId,
      },
    })
  } catch (error) {
    const message =
      error instanceof PaystackApiError
        ? error.message
        : "Could not start card payment."

    throw new PaymentServiceError("PAYMENT_INIT_FAILED", message, 502)
  }

  await insertPaymentRecord({
    bookingId: booking.id,
    locationId: booking.locationId,
    userId: booking.userId,
    providerReference: initialized.reference,
    amount: booking.totalAmount,
    currency: booking.currency,
    paymentMethod: "card",
    rawPayload: initialized as unknown as Record<string, unknown>,
  })

  return buildResult({
    method: "card",
    reference: initialized.reference,
    status: "pending",
    displayText: "You will be redirected to a secure card checkout.",
    booking,
    authorizationUrl: initialized.authorization_url,
  })
}

export async function initiateBookingPayment(input: {
  bookingId: string
  userId: string
  body: unknown
}): Promise<InitiatePaymentResult> {
  await runBookingExpirySweep()

  const parsed = initiatePaymentBodySchema.parse(input.body)
  const method: PaymentMethodChoice = parsed.method ?? "mpesa"

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

  if (method === "card") {
    return initiateCardPayment(booking)
  }

  return initiateMpesaPayment(booking, parsed.phone)
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
