import db from "@/db/drizzle"
import type { BookingPaymentContext } from "@/server/payments/types"
import {
  ensurePlaySessionForBooking,
  type EnsurePlaySessionBookingInput,
  type PlaySessionRecord,
} from "@/server/sessions/play-sessions"
import { createServiceTenantContext } from "@/server/tenancy/context-factory"
import type { TenantContext } from "@/server/tenancy/types"
import {
  buildBookingConfirmedOutboxEvent,
  buildPaymentConfirmedOutboxEvent,
} from "@/server/workers/events.mjs"
import { enqueueOutboxEvent } from "@/server/workers/outbox-repository"
import { scheduleNextLifecycleIntent } from "@/server/sessions/lifecycle"

type ConfirmationTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0]

export interface ConfirmationSideEffectsInput {
  tenantId: string
  paymentId: string
  reference: string
  source: "webhook" | "verify"
  bookingContext: BookingPaymentContext
}

function toEnsureBookingInput(
  tenantId: string,
  bookingContext: BookingPaymentContext,
): EnsurePlaySessionBookingInput {
  return {
    id: bookingContext.id,
    tenantId,
    locationId: bookingContext.locationId,
    resourceId: bookingContext.resourceId,
    userId: bookingContext.userId,
    status: "confirmed",
    paymentStatus: "paid",
    startTime: bookingContext.startTime,
    endTime: bookingContext.endTime,
    pricingRuleSnapshot: bookingContext.pricingRuleSnapshot,
    totalAmount: bookingContext.totalAmount,
    currency: bookingContext.currency,
  }
}

function createConfirmationContext(
  tenantId: string,
  bookingId: string,
): TenantContext {
  return createServiceTenantContext({
    tenantId,
    actorId: "payment-confirmation",
    correlationId: `confirm-booking:${bookingId}`,
  })
}

export async function writeConfirmationDurableSideEffects(
  tx: ConfirmationTransaction,
  input: ConfirmationSideEffectsInput,
): Promise<PlaySessionRecord> {
  const serviceContext = createConfirmationContext(
    input.tenantId,
    input.bookingContext.id,
  )

  const session = await ensurePlaySessionForBooking(
    serviceContext,
    toEnsureBookingInput(input.tenantId, input.bookingContext),
    tx,
  )

  if (!session) {
    throw new Error(
      `Failed to ensure play session for booking ${input.bookingContext.id}.`,
    )
  }

  const scope = {
    tenantId: input.tenantId,
    locationId: input.bookingContext.locationId,
    resourceId: input.bookingContext.resourceId,
    playSessionId: session.id,
    correlationId: serviceContext.correlationId,
  }

  await enqueueOutboxEvent(
    buildPaymentConfirmedOutboxEvent({
      ...scope,
      bookingId: input.bookingContext.id,
      paymentId: input.paymentId,
      reference: input.reference,
      amount: input.bookingContext.totalAmount,
      currency: input.bookingContext.currency,
      source: input.source,
    }),
    tx,
  )

  await enqueueOutboxEvent(
    buildBookingConfirmedOutboxEvent({
      ...scope,
      bookingId: input.bookingContext.id,
      userId: input.bookingContext.userId,
      startTime: input.bookingContext.startTime.toISOString(),
      endTime: input.bookingContext.endTime.toISOString(),
    }),
    tx,
  )

  await scheduleNextLifecycleIntent(
    {
      session,
      correlationId: serviceContext.correlationId,
      cause: "payment_confirmed",
    },
    tx,
  )

  return session
}

export async function repairConfirmationDurableSideEffects(
  input: ConfirmationSideEffectsInput,
): Promise<void> {
  await db.transaction(async (tx) => {
    await writeConfirmationDurableSideEffects(tx, input)
  })
}
