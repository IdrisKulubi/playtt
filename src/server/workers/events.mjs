import { sessionLifecycleIdempotencyKey } from "../sessions/lifecycle-schedule.mjs"

export const EVENT_TYPES = {
  PAYMENT_CONFIRMED_V1: "payment.confirmed.v1",
  BOOKING_CONFIRMED_V1: "booking.confirmed.v1",
  SESSION_PREPARING_V1: "session.preparing.v1",
  SESSION_STARTED_V1: "session.started.v1",
  SESSION_ENDING_V1: "session.ending.v1",
  SESSION_COMPLETED_V1: "session.completed.v1",
  SESSION_RESETTING_V1: "session.resetting.v1",
  SCORE_UPDATED_V1: "score.updated.v1",
  MEDIA_DELETE_V1: "media.delete.v1",
}

export const EVENT_VERSION = 1

export const SESSION_LIFECYCLE_EVENT_TYPES = [
  EVENT_TYPES.SESSION_PREPARING_V1,
  EVENT_TYPES.SESSION_STARTED_V1,
  EVENT_TYPES.SESSION_ENDING_V1,
  EVENT_TYPES.SESSION_COMPLETED_V1,
  EVENT_TYPES.SESSION_RESETTING_V1,
]

export function paymentConfirmedIdempotencyKey(paymentId) {
  return `payment.confirmed.v1:${paymentId}`
}

export function bookingConfirmedIdempotencyKey(bookingId) {
  return `booking.confirmed.v1:${bookingId}`
}

export { sessionLifecycleIdempotencyKey }

export function buildPaymentConfirmedOutboxEvent(input) {
  return {
    tenantId: input.tenantId,
    venueId: input.locationId,
    resourceId: input.resourceId,
    sessionId: input.playSessionId,
    aggregateType: "payment",
    aggregateId: input.paymentId,
    eventType: EVENT_TYPES.PAYMENT_CONFIRMED_V1,
    eventVersion: EVENT_VERSION,
    correlationId: input.correlationId,
    payload: {
      bookingId: input.bookingId,
      paymentId: input.paymentId,
      reference: input.reference,
      amount: input.amount,
      currency: input.currency,
      source: input.source,
    },
    idempotencyKey: paymentConfirmedIdempotencyKey(input.paymentId),
  }
}

export function buildBookingConfirmedOutboxEvent(input) {
  return {
    tenantId: input.tenantId,
    venueId: input.locationId,
    resourceId: input.resourceId,
    sessionId: input.playSessionId,
    aggregateType: "booking",
    aggregateId: input.bookingId,
    eventType: EVENT_TYPES.BOOKING_CONFIRMED_V1,
    eventVersion: EVENT_VERSION,
    correlationId: input.correlationId,
    payload: {
      bookingId: input.bookingId,
      playSessionId: input.playSessionId,
      locationId: input.locationId,
      resourceId: input.resourceId,
      userId: input.userId,
      startTime: input.startTime,
      endTime: input.endTime,
    },
    idempotencyKey: bookingConfirmedIdempotencyKey(input.bookingId),
  }
}

export function buildSessionLifecycleOutboxEvent(input) {
  return {
    tenantId: input.tenantId,
    venueId: input.locationId,
    resourceId: input.resourceId,
    sessionId: input.playSessionId,
    aggregateType: "play_session",
    aggregateId: input.playSessionId,
    eventType: input.eventType,
    eventVersion: EVENT_VERSION,
    correlationId: input.correlationId,
    causationId: input.causationId ?? null,
    availableAt: input.availableAt,
    payload: {
      playSessionId: input.playSessionId,
      bookingId: input.bookingId,
      toStatus: input.toStatus,
      cause: input.cause ?? "lifecycle_scheduler",
    },
    idempotencyKey: sessionLifecycleIdempotencyKey(
      input.eventType,
      input.playSessionId,
      input.toStatus,
    ),
  }
}
