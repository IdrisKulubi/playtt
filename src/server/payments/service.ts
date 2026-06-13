import {
  getPaymentCallbackUrl,
  kesToPaystackAmount,
  PAYSTACK_CURRENCY,
} from "@/server/payments/constants"
import { confirmModificationPayment } from "@/server/bookings/modifications/confirm-payment"
import { confirmCoachSubscriptionPurchase } from "@/server/coach/confirm-subscription"
import { confirmBookingPayment } from "@/server/payments/confirm-booking"
import { confirmReplayPackPurchase } from "@/server/replays/confirm-pack-purchase"
import { PaymentServiceError } from "@/server/payments/errors"
import {
  initializeHostedTransaction,
  PaystackApiError,
  verifyPaystackTransaction,
} from "@/server/payments/paystack-client"
import {
  expireStalePendingBookings,
  findLatestPaymentForBooking,
  getBookingPaymentContext,
  insertPaymentRecord,
} from "@/server/payments/repository"
import type {
  BookingPaymentContext,
  InitiatePaymentResult,
  PaymentStatusResult,
} from "@/server/payments/types"

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
  reference: string
  status: string
  displayText: string
  booking: BookingPaymentContext
  authorizationUrl?: string
}): InitiatePaymentResult {
  return {
    method: "hosted",
    reference: input.reference,
    status: input.status,
    displayText: input.displayText,
    expiresAt: input.booking.expiresAt?.toISOString() ?? null,
    bookingId: input.booking.id,
    returnUrl: getPaymentCallbackUrl(input.booking.id),
    authorizationUrl: input.authorizationUrl,
  }
}

async function initiateHostedPayment(
  booking: BookingPaymentContext,
): Promise<InitiatePaymentResult> {
  const latestPayment = await findLatestPaymentForBooking(booking.id)

  if (latestPayment?.status === "pending") {
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
    initialized = await initializeHostedTransaction({
      email: booking.userEmail,
      amount,
      currency: PAYSTACK_CURRENCY,
      callbackUrl: getPaymentCallbackUrl(booking.id),
      metadata: {
        bookingId: booking.id,
        userId: booking.userId,
      },
    })
  } catch (error) {
    const message =
      error instanceof PaystackApiError
        ? error.message
        : "Could not start payment."

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
    reference: initialized.reference,
    status: "pending",
    displayText: "You will be redirected to a secure checkout page.",
    booking,
    authorizationUrl: initialized.authorization_url,
  })
}

export async function initiateBookingPayment(input: {
  bookingId: string
  userId: string
  body: unknown
}): Promise<InitiatePaymentResult> {
  void input.body

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

  assertBookingPayable(booking)

  return initiateHostedPayment(booking)
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
    channel?: string | null
    paid_at?: string | null
    gateway_response?: string | null
    metadata?: Record<string, unknown> | string | null
  }
}) {
  if (input.event !== "charge.success") {
    return { handled: false }
  }

  const metadata =
    typeof input.data.metadata === "object" && input.data.metadata !== null
      ? input.data.metadata
      : null

  const paymentType =
    metadata && "paymentType" in metadata
      ? String(metadata.paymentType)
      : null

  if (paymentType === "replay_pack") {
    const result = await confirmReplayPackPurchase({
      reference: input.data.reference,
      providerEventId: String(input.data.id),
      transaction: input.data,
    })
    return { handled: true, result }
  }

  if (paymentType === "coach_subscription") {
    const result = await confirmCoachSubscriptionPurchase({
      reference: input.data.reference,
      providerEventId: String(input.data.id),
      transaction: input.data,
    })
    return { handled: true, result }
  }

  const isModification = paymentType === "modification"

  const result = isModification
    ? await confirmModificationPayment({
        reference: input.data.reference,
        providerEventId: String(input.data.id),
        transaction: input.data,
      })
    : await confirmBookingPayment({
        reference: input.data.reference,
        providerEventId: String(input.data.id),
        transaction: input.data,
        source: "webhook",
      })

  if (!result.confirmed && !isModification) {
    const productResult = await confirmReplayPackPurchase({
      reference: input.data.reference,
      providerEventId: String(input.data.id),
      transaction: input.data,
    })

    if (productResult.confirmed) {
      return { handled: true, result: productResult }
    }

    const coachResult = await confirmCoachSubscriptionPurchase({
      reference: input.data.reference,
      providerEventId: String(input.data.id),
      transaction: input.data,
    })

    if (coachResult.confirmed) {
      return { handled: true, result: coachResult }
    }

    const modificationResult = await confirmModificationPayment({
      reference: input.data.reference,
      providerEventId: String(input.data.id),
      transaction: input.data,
    })

    return { handled: true, result: modificationResult }
  }

  return { handled: true, result }
}
