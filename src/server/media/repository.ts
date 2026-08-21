import { createHash } from "node:crypto"

import { and, eq, inArray, lt, sql } from "drizzle-orm"

import db from "@/db/drizzle"
import {
  bookings,
  mediaAssets,
  mediaEventInbox,
  playSessions,
} from "@/db/schema"
import { MEDIA_STALE_PENDING_HOURS } from "@/server/media/constants"
import type { MediaAssetRecord, MediaKind } from "@/server/media/types"
import type { TenantContext } from "@/server/tenancy/types"

type DbExecutor = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0]

function mapMediaAsset(row: typeof mediaAssets.$inferSelect): MediaAssetRecord {
  return {
    id: row.id,
    tenantId: row.tenantId,
    locationId: row.locationId,
    resourceId: row.resourceId,
    playSessionId: row.playSessionId,
    ownerUserId: row.ownerUserId,
    objectKey: row.objectKey,
    kind: row.kind,
    contentType: row.contentType,
    sizeBytes: row.sizeBytes,
    checksumSha256: row.checksumSha256,
    expectedContentType: row.expectedContentType,
    expectedMaxBytes: row.expectedMaxBytes,
    status: row.status,
    retentionClass: row.retentionClass,
    uploadedAt: row.uploadedAt?.toISOString() ?? null,
    readyAt: row.readyAt?.toISOString() ?? null,
    deletionRequestedAt: row.deletionRequestedAt?.toISOString() ?? null,
    deletedAt: row.deletedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export function hashMediaEventPayload(rawPayload: string) {
  return createHash("sha256").update(rawPayload, "utf8").digest("hex")
}

export async function getAuthorizedMediaAsset(
  context: TenantContext,
  input: {
    mediaId: string
    ownerUserId: string
  },
) {
  const [row] = await db
    .select()
    .from(mediaAssets)
    .where(
      and(
        eq(mediaAssets.tenantId, context.tenantId),
        eq(mediaAssets.id, input.mediaId),
        eq(mediaAssets.ownerUserId, input.ownerUserId),
      ),
    )
    .limit(1)

  return row ? mapMediaAsset(row) : null
}

export async function getMediaAssetById(
  context: TenantContext,
  mediaId: string,
) {
  const [row] = await db
    .select()
    .from(mediaAssets)
    .where(
      and(
        eq(mediaAssets.tenantId, context.tenantId),
        eq(mediaAssets.id, mediaId),
      ),
    )
    .limit(1)

  return row ? mapMediaAsset(row) : null
}

export async function getPlaySessionForMediaCreate(
  context: TenantContext,
  input: {
    playSessionId: string
    userId: string
  },
) {
  const [row] = await db
    .select({
      id: playSessions.id,
      tenantId: playSessions.tenantId,
      bookingId: playSessions.bookingId,
      locationId: playSessions.locationId,
      resourceId: playSessions.resourceId,
      bookingUserId: bookings.userId,
    })
    .from(playSessions)
    .innerJoin(bookings, eq(playSessions.bookingId, bookings.id))
    .where(
      and(
        eq(playSessions.tenantId, context.tenantId),
        eq(bookings.tenantId, context.tenantId),
        eq(playSessions.id, input.playSessionId),
        eq(bookings.userId, input.userId),
      ),
    )
    .limit(1)

  return row ?? null
}

export async function insertMediaAsset(
  input: {
    id?: string
    tenantId: string
    locationId: string
    resourceId: string
    playSessionId: string
    ownerUserId: string
    objectKey: string
    kind: MediaKind
    expectedContentType: string
    expectedMaxBytes: number
    retentionClass?: "session_short" | "replay_standard" | "replay_owned"
  },
  tx?: DbExecutor,
) {
  const executor = tx ?? db
  const [row] = await executor
    .insert(mediaAssets)
    .values({
      ...(input.id ? { id: input.id } : {}),
      tenantId: input.tenantId,
      locationId: input.locationId,
      resourceId: input.resourceId,
      playSessionId: input.playSessionId,
      ownerUserId: input.ownerUserId,
      objectKey: input.objectKey,
      kind: input.kind,
      expectedContentType: input.expectedContentType,
      expectedMaxBytes: input.expectedMaxBytes,
      retentionClass: input.retentionClass ?? "replay_standard",
      status: "pending_upload",
    })
    .returning()

  return mapMediaAsset(row!)
}

export async function insertMediaEventInbox(
  input: {
    tenantId: string
    mediaId: string
    eventType: string
    rawPayload: string
  },
  tx?: DbExecutor,
) {
  const executor = tx ?? db
  const payloadHash = hashMediaEventPayload(input.rawPayload)

  const [row] = await executor
    .insert(mediaEventInbox)
    .values({
      tenantId: input.tenantId,
      mediaId: input.mediaId,
      eventType: input.eventType,
      payloadHash,
      rawPayload: input.rawPayload,
      status: "received",
    })
    .onConflictDoNothing()
    .returning()

  if (row) {
    return { inserted: true as const, row }
  }

  const [existing] = await executor
    .select()
    .from(mediaEventInbox)
    .where(
      and(
        eq(mediaEventInbox.mediaId, input.mediaId),
        eq(mediaEventInbox.eventType, input.eventType),
        eq(mediaEventInbox.payloadHash, payloadHash),
      ),
    )
    .limit(1)

  return { inserted: false as const, row: existing ?? null }
}

export async function markMediaEventProcessed(
  inboxId: string,
  tx?: DbExecutor,
) {
  const executor = tx ?? db

  await executor
    .update(mediaEventInbox)
    .set({
      status: "processed",
      processedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(mediaEventInbox.id, inboxId))
}

export async function markMediaEventFailed(
  inboxId: string,
  lastError: string,
  tx?: DbExecutor,
) {
  const executor = tx ?? db

  await executor
    .update(mediaEventInbox)
    .set({
      status: "failed",
      lastError,
      updatedAt: new Date(),
    })
    .where(eq(mediaEventInbox.id, inboxId))
}

export async function transitionMediaAssetReady(
  input: {
    mediaId: string
    tenantId: string
    contentType: string
    sizeBytes: number
    checksumSha256: string | null
  },
  tx?: DbExecutor,
) {
  const executor = tx ?? db
  const now = new Date()

  const [row] = await executor
    .update(mediaAssets)
    .set({
      status: "ready",
      contentType: input.contentType,
      sizeBytes: input.sizeBytes,
      checksumSha256: input.checksumSha256,
      uploadedAt: now,
      readyAt: now,
      updatedAt: now,
    })
    .where(
      and(
        eq(mediaAssets.tenantId, input.tenantId),
        eq(mediaAssets.id, input.mediaId),
        inArray(mediaAssets.status, ["pending_upload", "uploaded", "ready"]),
      ),
    )
    .returning()

  return row ? mapMediaAsset(row) : null
}

export async function markMediaAssetFailed(
  input: {
    mediaId: string
    tenantId: string
    lastError?: string
  },
  tx?: DbExecutor,
) {
  const executor = tx ?? db

  const [row] = await executor
    .update(mediaAssets)
    .set({
      status: "failed",
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(mediaAssets.tenantId, input.tenantId),
        eq(mediaAssets.id, input.mediaId),
        inArray(mediaAssets.status, ["pending_upload", "uploaded"]),
      ),
    )
    .returning()

  void input.lastError
  return row ? mapMediaAsset(row) : null
}

export async function markMediaAssetDeletionPending(
  input: {
    mediaId: string
    tenantId: string
  },
  tx?: DbExecutor,
) {
  const executor = tx ?? db
  const now = new Date()

  const [row] = await executor
    .update(mediaAssets)
    .set({
      status: "deletion_pending",
      deletionRequestedAt: now,
      updatedAt: now,
    })
    .where(
      and(
        eq(mediaAssets.tenantId, input.tenantId),
        eq(mediaAssets.id, input.mediaId),
        inArray(mediaAssets.status, [
          "pending_upload",
          "uploaded",
          "ready",
          "failed",
        ]),
      ),
    )
    .returning()

  return row ? mapMediaAsset(row) : null
}

export async function markMediaAssetDeleted(
  input: {
    mediaId: string
    tenantId: string
  },
  tx?: DbExecutor,
) {
  const executor = tx ?? db
  const now = new Date()

  const [row] = await executor
    .update(mediaAssets)
    .set({
      status: "deleted",
      deletedAt: now,
      updatedAt: now,
    })
    .where(
      and(
        eq(mediaAssets.tenantId, input.tenantId),
        eq(mediaAssets.id, input.mediaId),
        eq(mediaAssets.status, "deletion_pending"),
      ),
    )
    .returning()

  return row ? mapMediaAsset(row) : null
}

export async function listMediaAssetsByIds(
  context: TenantContext,
  mediaIds: string[],
) {
  if (mediaIds.length === 0) {
    return []
  }

  const rows = await db
    .select()
    .from(mediaAssets)
    .where(
      and(
        eq(mediaAssets.tenantId, context.tenantId),
        inArray(mediaAssets.id, mediaIds),
      ),
    )

  return rows.map(mapMediaAsset)
}

export async function listStalePendingMediaAssets(now = new Date()) {
  const cutoff = new Date(
    now.getTime() - MEDIA_STALE_PENDING_HOURS * 60 * 60 * 1000,
  )

  return db
    .select()
    .from(mediaAssets)
    .where(
      and(
        eq(mediaAssets.status, "pending_upload"),
        lt(mediaAssets.createdAt, cutoff),
      ),
    )
    .then((rows) => rows.map(mapMediaAsset))
}

export async function listDeletionPendingMediaAssets() {
  return db
    .select()
    .from(mediaAssets)
    .where(eq(mediaAssets.status, "deletion_pending"))
    .then((rows) => rows.map(mapMediaAsset))
}

export async function listReadyMediaAssetsForTenant(tenantId: string) {
  return db
    .select()
    .from(mediaAssets)
    .where(
      and(eq(mediaAssets.tenantId, tenantId), eq(mediaAssets.status, "ready")),
    )
    .then((rows) => rows.map(mapMediaAsset))
}

export async function countMediaAssetsByStatus(tenantId: string) {
  const rows = await db
    .select({
      status: mediaAssets.status,
      count: sql<number>`count(*)::int`,
    })
    .from(mediaAssets)
    .where(eq(mediaAssets.tenantId, tenantId))
    .groupBy(mediaAssets.status)

  return rows
}
