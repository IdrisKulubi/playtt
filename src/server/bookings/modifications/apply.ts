import {
  getPaymentCallbackUrl,
  kesToPaystackAmount,
  PAYSTACK_CURRENCY,
} from "@/server/payments/constants"
import { insertPaymentRecord } from "@/server/payments/repository"
import {
  initializeHostedTransaction,
  PaystackApiError,
} from "@/server/payments/paystack-client"
import { quoteBookingModification } from "@/server/bookings/modifications/quote"
import { BookingModificationError } from "@/server/bookings/modifications/errors"
import {
  applyModificationToBooking,
  attachPaymentToModification,
  getEditableBookingForUser,
  insertPendingModification,
} from "@/server/bookings/modifications/repository"
import type { modificationApplyBodySchema } from "@/server/bookings/modifications/validators"
import { authorize } from "@/server/tenancy/authorize-context.mjs"
import type { TenantContext } from "@/server/tenancy/types"
import type { z } from "zod/v3"
import { eq } from "drizzle-orm"

import db from "@/db/drizzle"
import { user } from "@/db/schema"

type ModificationInput = z.infer<typeof modificationApplyBodySchema>

export async function applyBookingModification(input: {
  context: TenantContext
  bookingId: string
  userId: string
  body: ModificationInput
}) {
  authorize(input.context, "booking.modify")
  const quoted = await quoteBookingModification(input)
  const delta = Number(quoted.quote.deltaAmount)
  const credit = Number(quoted.quote.creditAmount)

  if (delta <= 0) {
    const modification = await insertPendingModification(input.context, {
      bookingId: input.bookingId,
      userId: input.userId,
      changeType: quoted.quote.changeType,
      beforeSnapshot: quoted.beforeSnapshot,
      afterSnapshot: quoted.afterSnapshot,
      deltaAmount: quoted.quote.deltaAmount,
      currency: quoted.quote.currency,
    })

    await applyModificationToBooking(input.context, {
      modificationId: modification.id,
      afterSnapshot: quoted.afterSnapshot,
      creditAmount: quoted.quote.creditAmount,
    })

    return {
      modificationId: modification.id,
      status: "applied" as const,
      deltaAmount: quoted.quote.deltaAmount,
      creditAmount: quoted.quote.creditAmount,
      requiresPayment: false,
      displayText:
        credit > 0
          ? "Booking updated. The lower total is held as account credit with PlayTT."
          : "Booking updated.",
    }
  }

  const booking = await getEditableBookingForUser(input.context, {
    bookingId: input.bookingId,
    userId: input.userId,
  })

  if (!booking) {
    throw new BookingModificationError(
      "BOOKING_NOT_FOUND",
      "We could not find that booking.",
      404,
    )
  }

  const [account] = await db
    .select({ email: user.email })
    .from(user)
    .where(eq(user.id, input.userId))
    .limit(1)

  if (!account?.email) {
    throw new BookingModificationError(
      "PAYMENT_INIT_FAILED",
      "Your account needs an email address to pay.",
      400,
    )
  }

  const modification = await insertPendingModification(input.context, {
    bookingId: input.bookingId,
    userId: input.userId,
    changeType: quoted.quote.changeType,
    beforeSnapshot: quoted.beforeSnapshot,
    afterSnapshot: quoted.afterSnapshot,
    deltaAmount: quoted.quote.deltaAmount,
    currency: quoted.quote.currency,
  })

  let initialized

  try {
    initialized = await initializeHostedTransaction({
      email: account.email,
      amount: kesToPaystackAmount(delta),
      currency: PAYSTACK_CURRENCY,
      callbackUrl: getPaymentCallbackUrl(input.bookingId),
      metadata: {
        bookingId: input.bookingId,
        userId: input.userId,
        modificationId: modification.id,
        paymentType: "modification",
      },
    })
  } catch (error) {
    const message =
      error instanceof PaystackApiError
        ? error.message
        : "Could not start payment."

    throw new BookingModificationError("PAYMENT_INIT_FAILED", message, 502)
  }

  const payment = await insertPaymentRecord(input.context, {
    bookingId: input.bookingId,
    locationId: booking.locationId,
    userId: input.userId,
    providerReference: initialized.reference,
    amount: quoted.quote.deltaAmount,
    currency: quoted.quote.currency,
    paymentMethod: "card",
    rawPayload: initialized as unknown as Record<string, unknown>,
  })

  await attachPaymentToModification(input.context, {
    modificationId: modification.id,
    paymentId: payment.id,
  })

  return {
    modificationId: modification.id,
    status: "pending_payment" as const,
    deltaAmount: quoted.quote.deltaAmount,
    creditAmount: quoted.quote.creditAmount,
    requiresPayment: true,
    authorizationUrl: initialized.authorization_url,
    returnUrl: getPaymentCallbackUrl(input.bookingId),
    displayText: "Complete payment for your booking changes.",
  }
}

export async function getModificationStatus(input: {
  context: TenantContext
  bookingId: string
  modificationId: string
  userId: string
}) {
  authorize(input.context, "booking.read")
  const { getModificationById } =
    await import("@/server/bookings/modifications/repository")

  const modification = await getModificationById(input.context, {
    modificationId: input.modificationId,
    userId: input.userId,
  })

  if (!modification || modification.bookingId !== input.bookingId) {
    throw new BookingModificationError(
      "MODIFICATION_NOT_FOUND",
      "We could not find that change request.",
      404,
    )
  }

  return {
    modificationId: modification.id,
    status: modification.status,
    applied: modification.status === "applied",
  }
}
