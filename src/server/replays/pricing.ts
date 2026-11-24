import { and, eq } from "drizzle-orm"

import db from "@/db/drizzle"
import { featureFlags } from "@/db/schema"
import { REPLAY_PACK_CREDITS, REPLAY_PACK_PRICE_KES } from "@/server/replays/constants"
import { authorize } from "@/server/tenancy/authorize-context.mjs"
import { writeAuditLog } from "@/server/tenancy/audit-log.mjs"
import type { TenantContext } from "@/server/tenancy/types"

/*
 * Admin-set price per replay clip. Stored as one tenant-scoped row in
 * `feature_flags` (key below, value in `scope`) so no schema migration is
 * needed. That key is not in KNOWN_FEATURE_FLAG_KEYS, so it never shows on the
 * Feature flags page.
 */
export const REPLAY_CLIP_PRICING_KEY = "replay_clip_pricing"

export const DEFAULT_CLIP_PRICE_KES = Math.round(REPLAY_PACK_PRICE_KES / REPLAY_PACK_CREDITS)
export const MIN_CLIPS_PER_PURCHASE = 1
export const MAX_CLIPS_PER_PURCHASE = 50
export const MIN_CLIP_PRICE_KES = 1
export const MAX_CLIP_PRICE_KES = 10_000

export type ReplayClipPricing = {
  unitPriceKes: number
  minClips: number
  maxClips: number
  /** Default bundle size, used when a client (e.g. older mobile builds) doesn't send a quantity. */
  packCredits: number
  updatedAt: string | null
}

function readUnitPrice(scope: Record<string, unknown> | null | undefined) {
  const value = Number(scope?.unitPriceKes)
  return Number.isInteger(value) && value >= MIN_CLIP_PRICE_KES && value <= MAX_CLIP_PRICE_KES
    ? value
    : DEFAULT_CLIP_PRICE_KES
}

/** Read without a permission check: every signed-in player needs the price to buy. */
export async function loadReplayClipPricing(tenantId: string): Promise<ReplayClipPricing> {
  const [row] = await db
    .select({ scope: featureFlags.scope, updatedAt: featureFlags.updatedAt })
    .from(featureFlags)
    .where(and(eq(featureFlags.tenantId, tenantId), eq(featureFlags.key, REPLAY_CLIP_PRICING_KEY)))
    .limit(1)

  return {
    unitPriceKes: readUnitPrice(row?.scope),
    minClips: MIN_CLIPS_PER_PURCHASE,
    maxClips: MAX_CLIPS_PER_PURCHASE,
    packCredits: REPLAY_PACK_CREDITS,
    updatedAt: row?.updatedAt?.toISOString() ?? null,
  }
}

export async function getReplayClipPricingForAdmin(context: TenantContext) {
  authorize(context, "catalog.read")
  return loadReplayClipPricing(context.tenantId)
}

export async function setReplayClipPriceForAdmin(context: TenantContext, unitPriceKes: number) {
  authorize(context, "catalog.manage")

  if (!Number.isInteger(unitPriceKes) || unitPriceKes < MIN_CLIP_PRICE_KES || unitPriceKes > MAX_CLIP_PRICE_KES) {
    throw new Error(`Price per clip must be a whole number between ${MIN_CLIP_PRICE_KES} and ${MAX_CLIP_PRICE_KES} KES.`)
  }

  const previous = await loadReplayClipPricing(context.tenantId)

  await db
    .insert(featureFlags)
    .values({
      tenantId: context.tenantId,
      key: REPLAY_CLIP_PRICING_KEY,
      enabled: true,
      scope: { unitPriceKes },
    })
    .onConflictDoUpdate({
      target: [featureFlags.tenantId, featureFlags.key],
      set: { enabled: true, scope: { unitPriceKes }, updatedAt: new Date() },
    })

  await writeAuditLog(context, {
    action: "replay_pricing.update",
    targetType: "replay_clip_pricing",
    targetId: null,
    metadata: { previousUnitPriceKes: previous.unitPriceKes, unitPriceKes },
  })

  return loadReplayClipPricing(context.tenantId)
}
