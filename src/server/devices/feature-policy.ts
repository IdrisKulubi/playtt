import { and, eq } from "drizzle-orm"

import db from "@/db/drizzle"
import { featureFlags } from "@/db/schema"
import { DEVICE_REGISTRY_FLAG_KEY } from "@/server/devices/access.mjs"
import type { TenantContext } from "@/server/tenancy/types"

export async function isDeviceRegistryEnabledForTenant(
  context: TenantContext,
): Promise<boolean> {
  const [row] = await db
    .select({ enabled: featureFlags.enabled })
    .from(featureFlags)
    .where(
      and(
        eq(featureFlags.tenantId, context.tenantId),
        eq(featureFlags.key, DEVICE_REGISTRY_FLAG_KEY),
      ),
    )
    .limit(1)

  if (row) {
    return row.enabled
  }

  return (
    process.env.DEVICE_REGISTRY_ENABLED === "true" ||
    process.env.NODE_ENV !== "production"
  )
}
