import { and, eq } from "drizzle-orm"

import db from "@/db/drizzle"
import { notifications, pushDeviceTokens } from "@/db/schema"
import {
  decryptCredentialSecret,
  parseCredentialKeyring,
} from "@/server/access/encryption"
import { isAccessFeatureEnabled } from "@/server/access/feature-policy"
import {
  NOTIFICATION_TEMPLATE_COPY,
  type NotificationPreferenceKey,
} from "@/server/notifications/contract"
import { deliverThenMarkSent } from "@/server/payments/notification-delivery.mjs"
import { createServiceTenantContext } from "@/server/tenancy/context-factory"
import { getNotificationPreferences } from "@/server/notifications/service"

const TEMPLATE_TO_PREFERENCE: Record<string, NotificationPreferenceKey> = {
  access_ready: "accessReady",
  access_failed: "accessFailed",
  session_reminder: "sessionReminder",
  session_warning: "sessionWarning",
  session_ended: "sessionEnded",
  replay_ready: "replayReady",
}

export const TEMPLATE_COPY = NOTIFICATION_TEMPLATE_COPY

function pushTokenAad(tenantId: string, tokenId: string) {
  return `playtt:push-token:${tenantId}:${tokenId}:token`
}

async function loadActivePushTokens(tenantId: string, userId: string) {
  const rows = await db
    .select()
    .from(pushDeviceTokens)
    .where(
      and(
        eq(pushDeviceTokens.tenantId, tenantId),
        eq(pushDeviceTokens.userId, userId),
        eq(pushDeviceTokens.status, "active"),
      ),
    )

  const keyring = parseCredentialKeyring()
  return rows.map((row) => ({
    id: row.id,
    platform: row.platform,
    token: decryptCredentialSecret(row.encryptedToken, pushTokenAad(tenantId, row.id), keyring),
  }))
}

export async function sendExpoPushMessages(
  messages: Array<{
    to: string
    title: string
    body: string
    data?: Record<string, string>
  }>,
) {
  if (messages.length === 0) return { delivered: 0 }

  const response = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify(messages),
    signal: AbortSignal.timeout(10_000),
  })

  if (!response.ok) {
    throw new Error(`Expo push API returned HTTP ${response.status}.`)
  }

  const result = (await response.json()) as { data?: Array<{ status?: string }> }
  const delivered =
    result.data?.filter((ticket) => ticket.status === "ok").length ?? messages.length
  return { delivered }
}

async function preferenceEnabled(
  tenantId: string,
  userId: string,
  templateKey: string,
) {
  const preferenceKey = TEMPLATE_TO_PREFERENCE[templateKey]
  if (!preferenceKey) return true
  const context = createServiceTenantContext({
    tenantId,
    actorId: userId,
    correlationId: `notification:${templateKey}:${userId}`,
  })
  const preferences = await getNotificationPreferences(context, { userId })
  return preferences[preferenceKey]
}

export async function queueAndDeliverPushNotification(input: {
  tenantId: string
  userId: string
  bookingId?: string | null
  locationId?: string | null
  templateKey: string
  deduplicationKey: string
  payload?: Record<string, unknown>
}) {
  if (!(await isAccessFeatureEnabled(
    createServiceTenantContext({
      tenantId: input.tenantId,
      actorId: "notification-worker",
      correlationId: input.deduplicationKey,
    }),
    "notifications",
  ))) {
    return { skipped: true }
  }

  if (!(await preferenceEnabled(input.tenantId, input.userId, input.templateKey))) {
    return { skipped: true, reason: "preference_disabled" }
  }

  const [pending] = await db
    .insert(notifications)
    .values({
      tenantId: input.tenantId,
      bookingId: input.bookingId ?? null,
      locationId: input.locationId ?? null,
      userId: input.userId,
      channel: "push",
      status: "pending",
      templateKey: input.templateKey,
      deduplicationKey: input.deduplicationKey,
      payload: input.payload ?? {},
    })
    .onConflictDoNothing()
    .returning({ id: notifications.id })

  const notificationId = pending?.id
  if (!notificationId) {
    const [existing] = await db
      .select({ id: notifications.id, status: notifications.status })
      .from(notifications)
      .where(
        and(
          eq(notifications.tenantId, input.tenantId),
          eq(notifications.userId, input.userId),
          eq(notifications.channel, "push"),
          eq(notifications.templateKey, input.templateKey),
          eq(notifications.deduplicationKey, input.deduplicationKey),
        ),
      )
      .limit(1)
    if (!existing || existing.status !== "pending") return { skipped: true }
  }

  const tokens = await loadActivePushTokens(input.tenantId, input.userId)
  if (tokens.length === 0) return { skipped: true, reason: "no_push_tokens" }

  const copy = TEMPLATE_COPY[input.templateKey]
  if (!copy) throw new Error(`Unknown notification template ${input.templateKey}.`)

  const data: Record<string, string> = {}
  if (input.bookingId) data.bookingId = input.bookingId
  if (input.payload?.replayId) data.replayId = String(input.payload.replayId)

  const targetId = notificationId ?? input.deduplicationKey
  await deliverThenMarkSent({
    idempotencyKey: `push/${input.templateKey}/${targetId}`,
    deliver: async () => {
      await sendExpoPushMessages(
        tokens.map((token) => ({
          to: token.token,
          title: copy.title,
          body: copy.body(input.bookingId ?? undefined),
          data: Object.keys(data).length > 0 ? data : undefined,
        })),
      )
    },
    markSent: async () => {
      await db
        .update(notifications)
        .set({ status: "sent", sentAt: new Date() })
        .where(
          and(
            eq(notifications.tenantId, input.tenantId),
            eq(notifications.userId, input.userId),
            eq(notifications.channel, "push"),
            eq(notifications.templateKey, input.templateKey),
            eq(notifications.deduplicationKey, input.deduplicationKey),
            eq(notifications.status, "pending"),
          ),
        )
    },
  })

  return { delivered: true }
}
