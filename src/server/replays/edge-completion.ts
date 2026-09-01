import { and, eq } from "drizzle-orm"

import db from "@/db/drizzle"
import { notifications, replays, user } from "@/db/schema"
import { validateCompletionAgainstPolicy } from "@/server/media/content-policy"
import { MediaServiceError } from "@/server/media/errors"
import { getMediaStore } from "@/server/media/factory"
import {
  getMediaAssetById,
  insertMediaEventInbox,
  markMediaEventFailed,
  markMediaEventProcessed,
  markMediaAssetFailed,
  transitionMediaAssetReady,
} from "@/server/media/repository"
import { ReplayServiceError } from "@/server/replays/errors"
import {
  getReplayRequestById,
  getReplayRequestByMediaAssetId,
  transitionReplayRequestStatus,
} from "@/server/replays/replay-requests-repository"
import { createCorrelationId } from "@/server/tenancy/correlation"
import type { TenantContext } from "@/server/tenancy/types"
import { enqueueOutboxEvent } from "@/server/workers/outbox-repository"
import { buildReplayReadyOutboxEvent } from "@/server/workers/events.mjs"

export interface CompleteReplayFromEdgeInput {
  tenantId: string
  deviceId: string
  mediaId: string
  replayRequestId?: string
  checksumSha256?: string | null
  sizeBytes?: number | null
  correlationId?: string
}

export interface CompleteReplayFromEdgeResult {
  replayId: string
  replayRequestId: string
  mediaId: string
  status: "ready"
  idempotent: boolean
}

function buildDeviceContext(
  input: Pick<CompleteReplayFromEdgeInput, "tenantId" | "deviceId" | "correlationId">,
): TenantContext {
  return {
    tenantId: input.tenantId,
    actor: { type: "device", id: input.deviceId },
    correlationId: input.correlationId ?? createCorrelationId(),
  }
}

async function resolveReplayRequest(
  context: TenantContext,
  input: CompleteReplayFromEdgeInput,
) {
  if (input.replayRequestId) {
    const replayRequest = await getReplayRequestById(
      context,
      input.replayRequestId,
    )

    if (!replayRequest) {
      throw new ReplayServiceError(
        "REPLAY_REQUEST_NOT_FOUND",
        "Replay request was not found.",
        404,
      )
    }

    if (replayRequest.mediaAssetId !== input.mediaId) {
      throw new ReplayServiceError(
        "REPLAY_REQUEST_FORBIDDEN",
        "Media asset does not match replay request.",
        403,
      )
    }

    return replayRequest
  }

  const replayRequest = await getReplayRequestByMediaAssetId(
    context,
    input.mediaId,
  )

  if (!replayRequest) {
    throw new ReplayServiceError(
      "REPLAY_REQUEST_NOT_FOUND",
      "Replay request was not found for media asset.",
      404,
    )
  }

  return replayRequest
}

export async function completeReplayFromEdge(
  input: CompleteReplayFromEdgeInput,
): Promise<CompleteReplayFromEdgeResult> {
  const context = buildDeviceContext(input)
  const replayRequest = await resolveReplayRequest(context, input)

  if (replayRequest.venueEdgeDeviceId !== input.deviceId) {
    throw new ReplayServiceError(
      "REPLAY_REQUEST_FORBIDDEN",
      "This replay request is not assigned to the authenticated device.",
      403,
    )
  }

  const asset = await getMediaAssetById(context, input.mediaId)

  if (!asset) {
    throw new ReplayServiceError(
      "REPLAY_MEDIA_NOT_FOUND",
      "Replay media asset was not found.",
      404,
    )
  }

  const [replay] = await db
    .select()
    .from(replays)
    .where(
      and(
        eq(replays.tenantId, context.tenantId),
        eq(replays.id, replayRequest.replayId),
      ),
    )
    .limit(1)

  if (!replay) {
    throw new ReplayServiceError(
      "REPLAY_NOT_FOUND",
      "Replay was not found.",
      404,
    )
  }

  if (
    replayRequest.status === "ready" &&
    replay.status === "ready" &&
    asset.status === "ready"
  ) {
    return {
      replayId: replay.id,
      replayRequestId: replayRequest.id,
      mediaId: asset.id,
      status: "ready",
      idempotent: true,
    }
  }

  if (
    replayRequest.status !== "verifying" &&
    replayRequest.status !== "uploading" &&
    replayRequest.status !== "ready"
  ) {
    throw new ReplayServiceError(
      "INVALID_REPLAY_REQUEST_TRANSITION",
      "Replay request is not ready for cloud verification.",
      409,
    )
  }

  const rawPayload = JSON.stringify({
    mediaId: asset.id,
    checksumSha256: input.checksumSha256 ?? null,
    sizeBytes: input.sizeBytes ?? null,
  })

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
    throw new ReplayServiceError(
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
    throw new ReplayServiceError(
      "MEDIA_OBJECT_MISSING",
      "Uploaded object was not found in storage.",
      409,
    )
  }

  if (
    input.sizeBytes != null &&
    Number.isFinite(input.sizeBytes) &&
    head.sizeBytes !== input.sizeBytes
  ) {
    throw new ReplayServiceError(
      "MEDIA_SIZE_MISMATCH",
      "Uploaded object size does not match edge report.",
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

    if (error instanceof MediaServiceError) {
      throw new ReplayServiceError(error.code, error.message, error.status)
    }

    throw error
  }

  const correlationId = input.correlationId ?? replayRequest.correlationId
  const recipientEmail = replay.userId
    ? (
        await db
          .select({ email: user.email })
          .from(user)
          .where(eq(user.id, replay.userId))
          .limit(1)
      )[0]?.email ?? null
    : null

  await db.transaction(async (tx) => {
    const inbox = await insertMediaEventInbox(
      {
        tenantId: asset.tenantId,
        mediaId: asset.id,
        eventType: "upload_complete",
        rawPayload,
      },
      tx,
    )

    if (!inbox.row) {
      throw new ReplayServiceError(
        "MEDIA_COMPLETION_ERROR",
        "Could not record media completion.",
        500,
      )
    }

    const readyAsset = await transitionMediaAssetReady(
      {
        mediaId: asset.id,
        tenantId: asset.tenantId,
        contentType: head.contentType ?? asset.expectedContentType,
        sizeBytes: head.sizeBytes,
        checksumSha256: input.checksumSha256 ?? null,
      },
      tx,
    )

    if (!readyAsset) {
      await markMediaEventFailed(inbox.row.id, "transition_failed", tx)
      throw new ReplayServiceError(
        "MEDIA_COMPLETION_ERROR",
        "Could not mark media as ready.",
        500,
      )
    }

    await markMediaEventProcessed(inbox.row.id, tx)

    if (replayRequest.status !== "ready") {
      await transitionReplayRequestStatus(
        context,
        {
          replayRequestId: replayRequest.id,
          toStatus: "ready",
        },
        tx,
      )
    }

    const now = new Date()
    await tx
      .update(replays)
      .set({
        status: "ready",
        readyAt: now,
        videoUrl: null,
        metadata: {
          ...(replay.metadata ?? {}),
          source: "replay_edge",
          replayRequestCorrelationId: correlationId,
        },
      })
      .where(
        and(
          eq(replays.tenantId, context.tenantId),
          eq(replays.id, replay.id),
        ),
      )

    if (replay.userId && recipientEmail) {
      await tx.insert(notifications).values({
        tenantId: context.tenantId,
        bookingId: replay.bookingId,
        locationId: replay.locationId,
        userId: replay.userId,
        channel: "email",
        status: "pending",
        templateKey: "replay_ready",
        recipient: recipientEmail,
        payload: {
          replayId: replay.id,
          locationId: replay.locationId,
        },
      })
    }

    await enqueueOutboxEvent(
      buildReplayReadyOutboxEvent({
        tenantId: context.tenantId,
        locationId: replayRequest.locationId,
        resourceId: replayRequest.resourceId,
        playSessionId: replayRequest.playSessionId,
        replayId: replay.id,
        replayRequestId: replayRequest.id,
        mediaAssetId: asset.id,
        bookingId: replay.bookingId,
        userId: replay.userId,
        correlationId,
      }),
      tx,
    )
  })

  // The venue display is the first delivery target: signal it directly after
  // the ready transaction commits. Email, push, and analysis remain durable
  // outbox work and therefore cannot delay playback on the TV.
  await publishReplayReadyRealtime({
    tenantId: context.tenantId,
    venueId: replayRequest.locationId,
    resourceId: replayRequest.resourceId,
    sessionId: replayRequest.playSessionId,
    replayId: replay.id,
    mediaId: asset.id,
  })

  return {
    replayId: replay.id,
    replayRequestId: replayRequest.id,
    mediaId: asset.id,
    status: "ready",
    idempotent: false,
  }
}

export async function enqueueCoachAnalysisForReplay(input: {
  tenantId: string
  replayId: string
  userId: string
  bookingId: string
}) {
  const { enqueueCoachAnalysis } = await import("@/server/coach/analysis")

  return enqueueCoachAnalysis({
    tenantId: input.tenantId,
    replayId: input.replayId,
    userId: input.userId,
    bookingId: input.bookingId,
  })
}

export async function publishReplayReadyRealtime(input: {
  tenantId: string
  venueId: string
  resourceId: string
  sessionId: string
  replayId: string
  mediaId: string
}) {
  const { getRealtimeAdapter } = await import("@/server/realtime/broadcaster")
  const { resourceChannel } = await import("@/server/realtime/types")
  const adapter = getRealtimeAdapter()

  try {
    await adapter.publish(resourceChannel(input.tenantId, input.resourceId), {
      type: "replay.ready",
      tenantId: input.tenantId,
      venueId: input.venueId,
      resourceId: input.resourceId,
      sessionId: input.sessionId,
      replayId: input.replayId,
      mediaId: input.mediaId,
    })
  } catch (error) {
    console.error("[realtime] replay.ready fan-out failed", error)
  }
}
