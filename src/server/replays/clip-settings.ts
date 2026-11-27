import { and, eq } from "drizzle-orm"

import db from "@/db/drizzle"
import { featureFlags } from "@/db/schema"
import {
  MAX_REPLAY_CLIP_SECONDS,
  MIN_REPLAY_CLIP_SECONDS,
  clipWindowFor,
  isValidClipDuration,
} from "@/server/replays/constants"
import { authorize } from "@/server/tenancy/authorize-context.mjs"
import { writeAuditLog } from "@/server/tenancy/audit-log.mjs"
import type { TenantContext } from "@/server/tenancy/types"

/*
 * Admin-set replay clip length. Stored like clip pricing: one tenant-scoped
 * `feature_flags` row (value in `scope`), so no migration is needed and it
 * never shows on the Feature flags page.
 *
 * The length is copied onto each replay request when it's created, so a
 * change only affects new taps; captures already running keep their window.
 */
export const REPLAY_CLIP_SETTINGS_KEY = "replay_clip_settings"

export type ReplayClipSettings = {
  clipDurationSeconds: number
  preRollSeconds: number
  postRollSeconds: number
  minSeconds: number
  maxSeconds: number
  updatedAt: string | null
}

/** Read without a permission check: every replay capture needs it. */
export async function loadReplayClipSettings(
  tenantId: string,
): Promise<ReplayClipSettings> {
  let row: { scope: Record<string, unknown> | null; updatedAt: Date | null } | undefined

  try {
    ;[row] = await db
      .select({ scope: featureFlags.scope, updatedAt: featureFlags.updatedAt })
      .from(featureFlags)
      .where(
        and(
          eq(featureFlags.tenantId, tenantId),
          eq(featureFlags.key, REPLAY_CLIP_SETTINGS_KEY),
        ),
      )
      .limit(1)
  } catch (error) {
    // A settings read must never block a replay: use the default length.
    console.error("[replays] clip settings read failed; using default", error)
    row = undefined
  }

  const stored = Number((row?.scope as { clipDurationSeconds?: unknown } | null)?.clipDurationSeconds)
  const window = clipWindowFor(Number.isFinite(stored) ? stored : undefined)

  return {
    ...window,
    minSeconds: MIN_REPLAY_CLIP_SECONDS,
    maxSeconds: MAX_REPLAY_CLIP_SECONDS,
    updatedAt: row?.updatedAt?.toISOString() ?? null,
  }
}

export async function getReplayClipSettingsForAdmin(context: TenantContext) {
  authorize(context, "catalog.read")
  return loadReplayClipSettings(context.tenantId)
}

export async function setReplayClipDurationForAdmin(
  context: TenantContext,
  clipDurationSeconds: number,
) {
  authorize(context, "catalog.manage")

  if (!isValidClipDuration(clipDurationSeconds)) {
    throw new Error(
      `Clip length must be a whole number of seconds between ${MIN_REPLAY_CLIP_SECONDS} and ${MAX_REPLAY_CLIP_SECONDS}.`,
    )
  }

  const previous = await loadReplayClipSettings(context.tenantId)

  await db
    .insert(featureFlags)
    .values({
      tenantId: context.tenantId,
      key: REPLAY_CLIP_SETTINGS_KEY,
      enabled: true,
      scope: { clipDurationSeconds },
    })
    .onConflictDoUpdate({
      target: [featureFlags.tenantId, featureFlags.key],
      set: { enabled: true, scope: { clipDurationSeconds }, updatedAt: new Date() },
    })

  await writeAuditLog(context, {
    action: "replay_clip_settings.update",
    targetType: "replay_clip_settings",
    targetId: null,
    metadata: {
      previousClipDurationSeconds: previous.clipDurationSeconds,
      clipDurationSeconds,
    },
  })

  return loadReplayClipSettings(context.tenantId)
}
