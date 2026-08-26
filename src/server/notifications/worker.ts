import { and, eq } from "drizzle-orm"

import db from "@/db/drizzle"
import { accessGrants } from "@/db/schema"
import { isAccessFeatureEnabled } from "@/server/access/feature-policy"
import { queueAndDeliverPushNotification } from "@/server/notifications/push-delivery"
import { createServiceTenantContext } from "@/server/tenancy/context-factory"
import { EVENT_TYPES, EVENT_VERSION } from "@/server/workers/events.mjs"
import { enqueueOutboxEvent } from "@/server/workers/outbox-repository"

type NotificationEvent = {
  tenantId: string | null
  correlationId: string
  payload: Record<string, unknown>
}

const SESSION_NOTIFICATIONS: Partial<
  Record<string, { templateKey: string; dedupeSuffix: string }>
> = {
  preparing: { templateKey: "session_reminder", dedupeSuffix: "reminder" },
  ending: { templateKey: "session_warning", dedupeSuffix: "warning" },
  completed: { templateKey: "session_ended", dedupeSuffix: "ended" },
}

async function consumeAccessReady(row: NotificationEvent) {
  const tenantId = row.tenantId
  const grantId = String(row.payload.grantId ?? "")
  const bookingId = String(row.payload.bookingId ?? "")
  const userId = String(row.payload.userId ?? "")
  if (!tenantId || !grantId || !bookingId || !userId) {
    throw new Error("access.ready.v1 event is missing notification identity.")
  }

  const [grant] = await db
    .select({ locationId: accessGrants.locationId })
    .from(accessGrants)
    .where(and(eq(accessGrants.tenantId, tenantId), eq(accessGrants.id, grantId)))
    .limit(1)

  return queueAndDeliverPushNotification({
    tenantId,
    userId,
    bookingId,
    locationId: grant?.locationId ?? null,
    templateKey: "access_ready",
    deduplicationKey: `access-ready:${grantId}`,
    payload: { grantId, bookingId },
  })
}

async function consumeAccessFailed(row: NotificationEvent) {
  const tenantId = row.tenantId
  const grantId = String(row.payload.grantId ?? "")
  const bookingId = String(row.payload.bookingId ?? "")
  const userId = String(row.payload.userId ?? "")
  if (!tenantId || !bookingId || !userId) {
    throw new Error("access.failed.v1 event is missing notification identity.")
  }

  const [grant] = grantId
    ? await db
        .select({ locationId: accessGrants.locationId })
        .from(accessGrants)
        .where(and(eq(accessGrants.tenantId, tenantId), eq(accessGrants.id, grantId)))
        .limit(1)
    : []

  return queueAndDeliverPushNotification({
    tenantId,
    userId,
    bookingId,
    locationId: grant?.locationId ?? null,
    templateKey: "access_failed",
    deduplicationKey: `access-failed:${grantId || bookingId}`,
    payload: { grantId, bookingId },
  })
}

export async function scheduleSessionNotification(input: {
  tenantId: string
  bookingId: string
  playSessionId: string
  locationId: string
  resourceId: string
  userId: string
  correlationId: string
  toStatus: string
}) {
  const config = SESSION_NOTIFICATIONS[input.toStatus]
  if (!config) return null

  const context = createServiceTenantContext({
    tenantId: input.tenantId,
    actorId: "notification-orchestration",
    correlationId: input.correlationId,
  })
  if (!(await isAccessFeatureEnabled(context, "notifications"))) return null

  return enqueueOutboxEvent({
    tenantId: input.tenantId,
    venueId: input.locationId,
    resourceId: input.resourceId,
    sessionId: input.playSessionId,
    aggregateType: "play_session",
    aggregateId: input.playSessionId,
    eventType: EVENT_TYPES.ACCESS_NOTIFICATION_REQUESTED_V1,
    eventVersion: EVENT_VERSION,
    correlationId: input.correlationId,
    payload: {
      bookingId: input.bookingId,
      playSessionId: input.playSessionId,
      locationId: input.locationId,
      userId: input.userId,
      templateKey: config.templateKey,
      deduplicationKey: `session:${input.playSessionId}:${config.dedupeSuffix}`,
    },
    idempotencyKey: `access.notification.requested.v1:${input.playSessionId}:${config.dedupeSuffix}`,
  })
}

async function consumeAccessNotificationRequested(row: NotificationEvent) {
  const tenantId = row.tenantId
  const bookingId = String(row.payload.bookingId ?? "")
  const userId = String(row.payload.userId ?? "")
  const templateKey = String(row.payload.templateKey ?? "")
  const deduplicationKey = String(row.payload.deduplicationKey ?? "")
  const locationId = String(row.payload.locationId ?? "")
  if (!tenantId || !bookingId || !userId || !templateKey || !deduplicationKey) {
    throw new Error("access.notification.requested.v1 event is incomplete.")
  }

  return queueAndDeliverPushNotification({
    tenantId,
    userId,
    bookingId,
    locationId: locationId || null,
    templateKey,
    deduplicationKey,
    payload: row.payload,
  })
}

export function createNotificationConsumers() {
  return {
    [EVENT_TYPES.ACCESS_READY_V1]: {
      eventVersion: EVENT_VERSION,
      consume: consumeAccessReady,
    },
    [EVENT_TYPES.ACCESS_FAILED_V1]: {
      eventVersion: EVENT_VERSION,
      consume: consumeAccessFailed,
    },
    [EVENT_TYPES.ACCESS_NOTIFICATION_REQUESTED_V1]: {
      eventVersion: EVENT_VERSION,
      consume: consumeAccessNotificationRequested,
    },
  }
}
