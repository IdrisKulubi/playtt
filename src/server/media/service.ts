import { randomUUID } from "node:crypto"

import { authorize } from "@/server/tenancy/authorize-context.mjs"
import type { TenantContext } from "@/server/tenancy/types"
import {
  MEDIA_DOWNLOAD_GRANT_TTL_SECONDS,
  MEDIA_EVENT_TYPES,
  MEDIA_OUTBOX_EVENT_TYPES,
  MEDIA_UPLOAD_GRANT_TTL_SECONDS,
} from "@/server/media/constants"
import {
  assertMediaKind,
  resolveMediaContentPolicy,
  validateCompletionAgainstPolicy,
} from "@/server/media/content-policy"
import { MediaServiceError } from "@/server/media/errors"
import { isPrivateMediaEnabledForTenant } from "@/server/media/feature-policy"
import { getMediaStore } from "@/server/media/factory"
import { buildMediaObjectKey } from "@/server/media/object-keys"
import {
  getAuthorizedMediaAsset,
  getMediaAssetById,
  getPlaySessionForMediaCreate,
  insertMediaAsset,
  insertMediaEventInbox,
  markMediaAssetDeletionPending,
  markMediaAssetFailed,
  markMediaEventFailed,
  markMediaEventProcessed,
  transitionMediaAssetReady,
} from "@/server/media/repository"
import type { MediaAssetRecord } from "@/server/media/types"
import { enqueueOutboxEvent } from "@/server/workers/outbox-repository"

async function requirePrivateMediaEnabled(context: TenantContext) {
  const enabled = await isPrivateMediaEnabledForTenant(context)

  if (!enabled) {
    throw new MediaServiceError(
      "MEDIA_DISABLED",
      "Private media is not enabled for this tenant.",
      503,
    )
  }
}

function serializeMediaAsset(asset: MediaAssetRecord) {
  return {
    id: asset.id,
    playSessionId: asset.playSessionId,
    kind: asset.kind,
    status: asset.status,
    objectKey: asset.objectKey,
    contentType: asset.contentType,
    sizeBytes: asset.sizeBytes,
    checksumSha256: asset.checksumSha256,
    expectedContentType: asset.expectedContentType,
    expectedMaxBytes: asset.expectedMaxBytes,
    retentionClass: asset.retentionClass,
    uploadedAt: asset.uploadedAt,
    readyAt: asset.readyAt,
    createdAt: asset.createdAt,
    updatedAt: asset.updatedAt,
  }
}

export async function createMediaAssetForSession(input: {
  context: TenantContext
  userId: string
  playSessionId: string
  kind: unknown
}) {
  authorize(input.context, "booking.read")
  await requirePrivateMediaEnabled(input.context)

  const kind = assertMediaKind(input.kind)
  const session = await getPlaySessionForMediaCreate(input.context, {
    playSessionId: input.playSessionId,
    userId: input.userId,
  })

  if (!session) {
    throw new MediaServiceError(
      "MEDIA_NOT_FOUND",
      "Play session not found.",
      404,
    )
  }

  const mediaId = randomUUID()
  const policy = resolveMediaContentPolicy(kind)
  const objectKey = buildMediaObjectKey({
    tenantId: session.tenantId,
    locationId: session.locationId,
    resourceId: session.resourceId,
    playSessionId: session.id,
    mediaId,
    kind,
  })

  const asset = await insertMediaAsset({
    id: mediaId,
    tenantId: session.tenantId,
    locationId: session.locationId,
    resourceId: session.resourceId,
    playSessionId: session.id,
    ownerUserId: input.userId,
    objectKey,
    kind,
    expectedContentType: policy.expectedContentType,
    expectedMaxBytes: policy.expectedMaxBytes,
  })

  return { media: serializeMediaAsset(asset) }
}

export async function issueMediaUploadGrant(input: {
  context: TenantContext
  userId: string
  mediaId: string
}) {
  authorize(input.context, "booking.read")
  await requirePrivateMediaEnabled(input.context)

  const asset = await getAuthorizedMediaAsset(input.context, {
    mediaId: input.mediaId,
    ownerUserId: input.userId,
  })

  if (!asset) {
    throw new MediaServiceError("MEDIA_NOT_FOUND", "Media asset not found.", 404)
  }

  if (asset.status !== "pending_upload" && asset.status !== "uploaded") {
    throw new MediaServiceError(
      "MEDIA_INVALID_STATE",
      "Upload grants are only available for pending media.",
      409,
    )
  }

  const store = getMediaStore()

  try {
    const grant = await store.createUploadGrant({
      objectKey: asset.objectKey,
      contentType: asset.expectedContentType,
      maxBytes: asset.expectedMaxBytes,
      expiresInSeconds: MEDIA_UPLOAD_GRANT_TTL_SECONDS,
    })

    return {
      mediaId: asset.id,
      grant,
    }
  } catch {
    throw new MediaServiceError(
      "MEDIA_STORE_UNAVAILABLE",
      "Media storage is temporarily unavailable.",
      503,
    )
  }
}

export async function issueMediaDownloadGrant(input: {
  context: TenantContext
  userId: string
  mediaId: string
}) {
  authorize(input.context, "account.read")
  await requirePrivateMediaEnabled(input.context)

  const asset = await getAuthorizedMediaAsset(input.context, {
    mediaId: input.mediaId,
    ownerUserId: input.userId,
  })

  if (!asset) {
    throw new MediaServiceError("MEDIA_NOT_FOUND", "Media asset not found.", 404)
  }

  if (asset.status !== "ready") {
    throw new MediaServiceError(
      "MEDIA_NOT_READY",
      "Media is not ready for playback.",
      409,
    )
  }

  const store = getMediaStore()

  try {
    const grant = await store.createDownloadGrant({
      objectKey: asset.objectKey,
      expiresInSeconds: MEDIA_DOWNLOAD_GRANT_TTL_SECONDS,
    })

    return {
      mediaId: asset.id,
      grant,
    }
  } catch {
    throw new MediaServiceError(
      "MEDIA_STORE_UNAVAILABLE",
      "Media storage is temporarily unavailable.",
      503,
    )
  }
}

export async function completeMediaUpload(input: {
  context: TenantContext
  userId: string
  mediaId: string
  checksumSha256?: string | null
}) {
  authorize(input.context, "booking.read")
  await requirePrivateMediaEnabled(input.context)

  const asset = await getAuthorizedMediaAsset(input.context, {
    mediaId: input.mediaId,
    ownerUserId: input.userId,
  })

  if (!asset) {
    throw new MediaServiceError("MEDIA_NOT_FOUND", "Media asset not found.", 404)
  }

  if (asset.status === "ready") {
    return { media: serializeMediaAsset(asset), idempotent: true as const }
  }

  if (asset.status === "deletion_pending" || asset.status === "deleted") {
    throw new MediaServiceError(
      "MEDIA_INVALID_STATE",
      "Media can no longer be completed.",
      409,
    )
  }

  const rawPayload = JSON.stringify({
    mediaId: asset.id,
    checksumSha256: input.checksumSha256 ?? null,
  })
  const inbox = await insertMediaEventInbox({
    tenantId: asset.tenantId,
    mediaId: asset.id,
    eventType: MEDIA_EVENT_TYPES.UPLOAD_COMPLETE,
    rawPayload,
  })

  if (!inbox.row) {
    throw new MediaServiceError(
      "MEDIA_COMPLETION_ERROR",
      "Could not record media completion.",
      500,
    )
  }

  if (!inbox.inserted && inbox.row.status === "processed") {
    const current = await getAuthorizedMediaAsset(input.context, {
      mediaId: input.mediaId,
      ownerUserId: input.userId,
    })

    if (current?.status === "ready") {
      return { media: serializeMediaAsset(current), idempotent: true as const }
    }
  }

  const store = getMediaStore()
  let head

  try {
    head = await store.headObject(asset.objectKey)
  } catch {
    await markMediaAssetFailed({
      mediaId: asset.id,
      tenantId: asset.tenantId,
      lastError: "head_failed",
    })
    await markMediaEventFailed(inbox.row.id, "head_failed")
    throw new MediaServiceError(
      "MEDIA_STORE_UNAVAILABLE",
      "Media storage is temporarily unavailable.",
      503,
    )
  }

  if (!head) {
    await markMediaAssetFailed({
      mediaId: asset.id,
      tenantId: asset.tenantId,
      lastError: "object_missing",
    })
    await markMediaEventFailed(inbox.row.id, "object_missing")
    throw new MediaServiceError(
      "MEDIA_OBJECT_MISSING",
      "Uploaded object was not found in storage.",
      409,
    )
  }

  try {
    validateCompletionAgainstPolicy({
      expectedContentType: asset.expectedContentType,
      expectedMaxBytes: asset.expectedMaxBytes,
      contentType: head.contentType,
      sizeBytes: head.sizeBytes,
    })
  } catch (error) {
    await markMediaAssetFailed({
      mediaId: asset.id,
      tenantId: asset.tenantId,
      lastError:
        error instanceof MediaServiceError ? error.code : "policy_violation",
    })
    await markMediaEventFailed(
      inbox.row.id,
      error instanceof MediaServiceError ? error.code : "policy_violation",
    )
    throw error
  }

  const ready = await transitionMediaAssetReady({
    mediaId: asset.id,
    tenantId: asset.tenantId,
    contentType: head.contentType ?? asset.expectedContentType,
    sizeBytes: head.sizeBytes,
    checksumSha256: input.checksumSha256 ?? null,
  })

  if (!ready) {
    throw new MediaServiceError(
      "MEDIA_COMPLETION_ERROR",
      "Could not mark media as ready.",
      500,
    )
  }

  await markMediaEventProcessed(inbox.row.id)

  return { media: serializeMediaAsset(ready), idempotent: false as const }
}

export async function requestMediaDeletion(input: {
  context: TenantContext
  userId: string
  mediaId: string
}) {
  authorize(input.context, "account.read")
  await requirePrivateMediaEnabled(input.context)

  const asset = await getAuthorizedMediaAsset(input.context, {
    mediaId: input.mediaId,
    ownerUserId: input.userId,
  })

  if (!asset) {
    throw new MediaServiceError("MEDIA_NOT_FOUND", "Media asset not found.", 404)
  }

  if (asset.status === "deleted") {
    return { media: serializeMediaAsset(asset), idempotent: true as const }
  }

  const pending = await markMediaAssetDeletionPending({
    mediaId: asset.id,
    tenantId: asset.tenantId,
  })

  if (!pending) {
    throw new MediaServiceError(
      "MEDIA_INVALID_STATE",
      "Media cannot be deleted in its current state.",
      409,
    )
  }

  await enqueueOutboxEvent({
    tenantId: pending.tenantId,
    venueId: pending.locationId,
    resourceId: pending.resourceId,
    sessionId: pending.playSessionId,
    aggregateType: "media_asset",
    aggregateId: pending.id,
    eventType: MEDIA_OUTBOX_EVENT_TYPES.DELETE_V1,
    correlationId: `media-delete:${pending.id}`,
    payload: {
      mediaId: pending.id,
      objectKey: pending.objectKey,
    },
    idempotencyKey: `media.delete.v1:${pending.id}`,
  })

  return { media: serializeMediaAsset(pending), idempotent: false as const }
}

export async function createPlaybackGrantForMediaAsset(input: {
  context: TenantContext
  userId: string
  mediaId: string
}) {
  const result = await issueMediaDownloadGrant(input)
  return result.grant
}

export async function createPlaybackGrantForReadyMedia(input: {
  context: TenantContext
  mediaId: string
}) {
  await requirePrivateMediaEnabled(input.context)

  const asset = await getMediaAssetById(input.context, input.mediaId)

  if (!asset) {
    throw new MediaServiceError("MEDIA_NOT_FOUND", "Media asset not found.", 404)
  }

  if (asset.status !== "ready") {
    throw new MediaServiceError(
      "MEDIA_NOT_READY",
      "Media is not ready for playback.",
      409,
    )
  }

  const store = getMediaStore()

  try {
    return await store.createDownloadGrant({
      objectKey: asset.objectKey,
      expiresInSeconds: MEDIA_DOWNLOAD_GRANT_TTL_SECONDS,
    })
  } catch {
    throw new MediaServiceError(
      "MEDIA_STORE_UNAVAILABLE",
      "Media storage is temporarily unavailable.",
      503,
    )
  }
}

export async function isPrivateMediaEnabled(context: TenantContext) {
  return isPrivateMediaEnabledForTenant(context)
}
