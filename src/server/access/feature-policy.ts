import { and, eq } from "drizzle-orm"

import db from "@/db/drizzle"
import { featureFlags } from "@/db/schema"
import type { TenantContext } from "@/server/tenancy/types"

export const ACCESS_FEATURE_FLAGS = {
  liveAccess: "live_access",
  ttlockProvider: "ttlock_provider",
  relayAutomation: "relay_automation",
  notifications: "access_notifications",
  remoteUnlock: "remote_unlock",
} as const

export type AccessFeature = keyof typeof ACCESS_FEATURE_FLAGS

const ENV_KEYS: Record<AccessFeature, string> = {
  liveAccess: "LIVE_ACCESS_ENABLED",
  ttlockProvider: "TTLOCK_PROVIDER_ENABLED",
  relayAutomation: "RELAY_AUTOMATION_ENABLED",
  notifications: "ACCESS_NOTIFICATIONS_ENABLED",
  remoteUnlock: "REMOTE_UNLOCK_ENABLED",
}

export async function isAccessFeatureEnabled(
  context: TenantContext,
  feature: AccessFeature,
) {
  const [row] = await db
    .select({ enabled: featureFlags.enabled })
    .from(featureFlags)
    .where(
      and(
        eq(featureFlags.tenantId, context.tenantId),
        eq(featureFlags.key, ACCESS_FEATURE_FLAGS[feature]),
      ),
    )
    .limit(1)

  return row?.enabled ?? process.env[ENV_KEYS[feature]] === "true"
}
