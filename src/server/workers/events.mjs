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
  REPLAY_READY_V1: "replay.ready.v1",
  ACCESS_PROVISION_REQUESTED_V1: "access.provision.requested.v1",
  ACCESS_MODIFY_REQUESTED_V1: "access.modify.requested.v1",
  ACCESS_READY_V1: "access.ready.v1",
  ACCESS_REVOKE_REQUESTED_V1: "access.revoke.requested.v1",
  ACCESS_REVOKED_V1: "access.revoked.v1",
  ACCESS_FAILED_V1: "access.failed.v1",
  RELAY_ACTION_REQUESTED_V1: "relay.action.requested.v1",
  ACCESS_NOTIFICATION_REQUESTED_V1: "access.notification.requested.v1",
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

export function replayReadyIdempotencyKey(replayId) {
  return `replay.ready.v1:${replayId}`
}

export function buildReplayReadyOutboxEvent(input) {
  return {
    tenantId: input.tenantId,
    venueId: input.locationId,
    resourceId: input.resourceId,
    sessionId: input.playSessionId,
    aggregateType: "replay",
    aggregateId: input.replayId,
    eventType: EVENT_TYPES.REPLAY_READY_V1,
    eventVersion: EVENT_VERSION,
    correlationId: input.correlationId,
    payload: {
      replayId: input.replayId,
      replayRequestId: input.replayRequestId,
      mediaId: input.mediaAssetId,
      playSessionId: input.playSessionId,
      bookingId: input.bookingId,
      userId: input.userId,
      locationId: input.locationId,
      resourceId: input.resourceId,
    },
    idempotencyKey: replayReadyIdempotencyKey(input.replayId),
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
