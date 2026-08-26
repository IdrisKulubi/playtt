import { createHmac, randomUUID } from "node:crypto"
import { and, eq, inArray } from "drizzle-orm"

import db from "@/db/drizzle"
import { notificationPreferences, pushDeviceTokens } from "@/db/schema"
import { encryptCredentialSecret, parseCredentialKeyring } from "@/server/access/encryption"
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  type NotificationPreferenceKey,
  type NotificationPreferences,
} from "@/server/notifications/contract"
import { authorize } from "@/server/tenancy/authorize-context.mjs"
import type { TenantContext } from "@/server/tenancy/types"

const TEMPLATE_KEYS: Record<NotificationPreferenceKey, string> = {
  accessReady: "access_ready",
  accessFailed: "access_failed",
  sessionReminder: "session_reminder",
  sessionWarning: "session_warning",
  sessionEnded: "session_ended",
  replayReady: "replay_ready",
}

const CHANNELS = ["email", "push"] as const

function pushTokenFingerprint(token: string) {
  const key = process.env.PLAYTT_CREDENTIAL_FINGERPRINT_KEY
  if (!key) throw new Error("PLAYTT_CREDENTIAL_FINGERPRINT_KEY is not configured.")
  return createHmac("sha256", key).update(`push:${token}`).digest("hex")
}

function pushTokenAad(tenantId: string, tokenId: string) {
  return `playtt:push-token:${tenantId}:${tokenId}:token`
}

export async function getNotificationPreferences(
  context: TenantContext,
  input: { userId: string },
): Promise<NotificationPreferences> {
  authorize(context, "account.read")
  const rows = await db
    .select({
      templateKey: notificationPreferences.templateKey,
      enabled: notificationPreferences.enabled,
    })
    .from(notificationPreferences)
    .where(
      and(
        eq(notificationPreferences.tenantId, context.tenantId),
        eq(notificationPreferences.userId, input.userId),
        inArray(notificationPreferences.channel, [...CHANNELS]),
        inArray(notificationPreferences.templateKey, Object.values(TEMPLATE_KEYS)),
      ),
    )

  return Object.fromEntries(
    Object.entries(TEMPLATE_KEYS).map(([key, templateKey]) => {
      const matching = rows.filter((row) => row.templateKey === templateKey)
      return [
        key,
        matching.length === 0 || matching.every((row) => row.enabled),
      ]
    }),
  ) as NotificationPreferences
}

export async function updateNotificationPreferences(
  context: TenantContext,
  input: {
    userId: string
    preferences: Partial<NotificationPreferences>
  },
) {
  authorize(context, "account.update")
  await db.transaction(async (tx) => {
    for (const [key, enabled] of Object.entries(input.preferences) as [
      NotificationPreferenceKey,
      boolean,
    ][]) {
      const templateKey = TEMPLATE_KEYS[key]
      if (!templateKey || typeof enabled !== "boolean") continue
      for (const channel of CHANNELS) {
        await tx
          .insert(notificationPreferences)
          .values({
            tenantId: context.tenantId,
            userId: input.userId,
            channel,
            templateKey,
            enabled,
          })
          .onConflictDoUpdate({
            target: [
              notificationPreferences.tenantId,
              notificationPreferences.userId,
              notificationPreferences.channel,
              notificationPreferences.templateKey,
            ],
            set: { enabled, updatedAt: new Date() },
          })
      }
    }
  })
  return getNotificationPreferences(context, { userId: input.userId })
}

export async function registerPushToken(
  context: TenantContext,
  input: {
    userId: string
    token: string
    platform: "ios" | "android"
    deviceName?: string
  },
) {
  authorize(context, "account.update")
  const fingerprint = pushTokenFingerprint(input.token)
  const tokenId = randomUUID()
  const keyring = parseCredentialKeyring()
  const encryptedToken = encryptCredentialSecret(
    input.token,
    pushTokenAad(context.tenantId, tokenId),
    keyring,
  )
  const installationId = `${input.platform}:${fingerprint.slice(0, 32)}`

  const [row] = await db
    .insert(pushDeviceTokens)
    .values({
      id: tokenId,
      tenantId: context.tenantId,
      userId: input.userId,
      installationId,
      platform: input.platform,
      encryptedToken,
      encryptionKeyVersion: keyring.current,
      tokenFingerprint: fingerprint,
      status: "active",
      failureCount: 0,
      lastRegisteredAt: new Date(),
      revokedAt: null,
    })
    .onConflictDoUpdate({
      target: [pushDeviceTokens.tenantId, pushDeviceTokens.tokenFingerprint],
      set: {
        userId: input.userId,
        platform: input.platform,
        status: "active",
        failureCount: 0,
        lastRegisteredAt: new Date(),
        revokedAt: null,
      },
    })
    .returning({
      id: pushDeviceTokens.id,
      platform: pushDeviceTokens.platform,
      status: pushDeviceTokens.status,
    })

  return row
}

export async function revokePushToken(
  context: TenantContext,
  input: {
    userId: string
    token: string
    platform: "ios" | "android"
  },
) {
  authorize(context, "account.update")
  const [row] = await db
    .update(pushDeviceTokens)
    .set({ status: "revoked", revokedAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(pushDeviceTokens.tenantId, context.tenantId),
        eq(pushDeviceTokens.userId, input.userId),
        eq(pushDeviceTokens.platform, input.platform),
        eq(pushDeviceTokens.tokenFingerprint, pushTokenFingerprint(input.token)),
      ),
    )
    .returning({ id: pushDeviceTokens.id })

  return { revoked: Boolean(row) }
}

export { DEFAULT_NOTIFICATION_PREFERENCES }
