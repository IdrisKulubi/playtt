import { and, eq } from "drizzle-orm"

import db from "@/db/drizzle"
import { featureFlags } from "@/db/schema"
import { PRIVATE_MEDIA_FLAG_KEY } from "@/server/media/access.mjs"
import type { TenantContext } from "@/server/tenancy/types"

export async function isPrivateMediaEnabledForTenant(
  context: TenantContext,
): Promise<boolean> {
  const [row] = await db
    .select({ enabled: featureFlags.enabled })
    .from(featureFlags)
    .where(
      and(
        eq(featureFlags.tenantId, context.tenantId),
        eq(featureFlags.key, PRIVATE_MEDIA_FLAG_KEY),
      ),
    )
    .limit(1)

  if (row) {
    return row.enabled
  }

  return (
    process.env.PRIVATE_MEDIA_ENABLED === "true" ||
    process.env.NODE_ENV !== "production"
  )
}
