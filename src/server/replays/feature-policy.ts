import { and, eq } from "drizzle-orm"

import db from "@/db/drizzle"
import { featureFlags } from "@/db/schema"
import type { TenantContext } from "@/server/tenancy/types"
import {
  isFeatureFlagEnabledForScope,
  parseFeatureFlagScope,
  type FeatureFlagScopeTarget,
} from "@/server/replays/feature-scope"
import {
  REPLAY_EDGE_FLAG_KEY,
  resolveFeatureFlagEnvFallback,
  VENUE_EDGE_CONFIG_V2_FLAG_KEY,
} from "@/server/replays/feature-env-fallback"

export {
  REPLAY_EDGE_FLAG_KEY,
  VENUE_EDGE_CONFIG_V2_FLAG_KEY,
  resolveFeatureFlagEnvFallback,
} from "@/server/replays/feature-env-fallback"

async function readFeatureFlag(
  tenantId: string,
  key: string,
): Promise<{ enabled: boolean; scope: Record<string, unknown> | null } | null> {
  const [row] = await db
    .select({
      enabled: featureFlags.enabled,
      scope: featureFlags.scope,
    })
    .from(featureFlags)
    .where(and(eq(featureFlags.tenantId, tenantId), eq(featureFlags.key, key)))
    .limit(1)

  if (!row) {
    return null
  }

  return {
    enabled: row.enabled,
    scope: row.scope ?? null,
  }
}

export async function isFeatureFlagEnabledForTarget(
  tenantId: string,
  key: string,
  target: FeatureFlagScopeTarget = {},
): Promise<boolean> {
  const row = await readFeatureFlag(tenantId, key)
  const enabled = row?.enabled ?? resolveFeatureFlagEnvFallback(key)
  const scope = parseFeatureFlagScope(row?.scope)

  return isFeatureFlagEnabledForScope(enabled, scope, target)
}

export async function isReplayEdgeEnabledForTenant(
  context: TenantContext,
  target: FeatureFlagScopeTarget = {},
): Promise<boolean> {
  return isFeatureFlagEnabledForTarget(
    context.tenantId,
    REPLAY_EDGE_FLAG_KEY,
    target,
  )
}

export async function isVenueEdgeConfigV2EnabledForLocation(
  tenantId: string,
  locationId: string,
): Promise<boolean> {
  return isFeatureFlagEnabledForTarget(tenantId, VENUE_EDGE_CONFIG_V2_FLAG_KEY, {
    locationId,
  })
}
