import { and, eq } from "drizzle-orm"

import db from "@/db/drizzle"
import { featureFlags } from "@/db/schema"
import type { TenantContext } from "@/server/tenancy/types"

export const REPLAY_EDGE_FLAG_KEY = "replay_edge"

export async function isReplayEdgeEnabledForTenant(
  context: TenantContext,
): Promise<boolean> {
  const [row] = await db
    .select({ enabled: featureFlags.enabled })
    .from(featureFlags)
    .where(
      and(
        eq(featureFlags.tenantId, context.tenantId),
        eq(featureFlags.key, REPLAY_EDGE_FLAG_KEY),
      ),
    )
    .limit(1)

  if (row) {
    return row.enabled
  }

  return (
    process.env.REPLAY_EDGE_ENABLED === "true" ||
    process.env.NODE_ENV !== "production"
  )
}
