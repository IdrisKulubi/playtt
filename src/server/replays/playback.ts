import { and, eq } from "drizzle-orm"

import db from "@/db/drizzle"
import { deviceAssignments, playSessions, replayRequests, replays } from "@/db/schema"
import { getCurrentAssignmentForDevice } from "@/server/devices/devices"
import {
  createPlaybackGrantForMediaAsset,
  createPlaybackGrantForReadyMedia,
} from "@/server/media/service"
import { REPLAY_CLIP_DURATION_SECONDS } from "@/server/replays/constants"
import { ReplayServiceError } from "@/server/replays/errors"
import { authorize } from "@/server/tenancy/authorize-context.mjs"
import type { TenantContext } from "@/server/tenancy/types"

function metadataTitle(metadata: Record<string, unknown> | null | undefined) {
  const title = metadata?.title
  return typeof title === "string" && title.trim() ? title.trim() : "Session clip"
}

async function getReplayPlaybackContext(
  context: TenantContext,
  replayId: string,
) {
  const [row] = await db
    .select({
      id: replays.id,
      tenantId: replays.tenantId,
      bookingId: replays.bookingId,
      playSessionId: replays.playSessionId,
      locationId: replays.locationId,
      userId: replays.userId,
      mediaAssetId: replays.mediaAssetId,
      status: replays.status,
      metadata: replays.metadata,
      readyAt: replays.readyAt,
      requestedAt: replays.requestedAt,
      resourceId: playSessions.resourceId,
    })
    .from(replays)
    .leftJoin(playSessions, eq(replays.playSessionId, playSessions.id))
    .where(
      and(
        eq(replays.tenantId, context.tenantId),
        eq(replays.id, replayId),
      ),
    )
    .limit(1)

  return row ?? null
}

async function hasDisplayAssignmentForResource(input: {
  tenantId: string
  deviceId: string
  resourceId: string
}) {
  const assignment = await getCurrentAssignmentForDevice(
    input.tenantId,
    input.deviceId,
  )

  if (!assignment || assignment.role !== "display") {
    return false
  }

  if (assignment.resourceId === input.resourceId) {
    return true
  }

  const [row] = await db
    .select({ id: deviceAssignments.id })
    .from(deviceAssignments)
    .where(
      and(
        eq(deviceAssignments.tenantId, input.tenantId),
        eq(deviceAssignments.deviceId, input.deviceId),
        eq(deviceAssignments.resourceId, input.resourceId),
        eq(deviceAssignments.role, "display"),
      ),
    )
    .limit(1)

  return Boolean(row)
}

export async function authorizeReplayPlayback(input: {
  context: TenantContext
  replayId: string
  userId?: string
  deviceId?: string
}) {
  const replay = await getReplayPlaybackContext(input.context, input.replayId)

  if (!replay) {
    throw new ReplayServiceError("REPLAY_NOT_FOUND", "Replay was not found.", 404)
  }

  if (replay.status !== "ready") {
    throw new ReplayServiceError(
      "REPLAY_NOT_READY",
      "Replay is not ready for playback.",
      409,
    )
  }

  if (!replay.mediaAssetId || !replay.resourceId) {
    throw new ReplayServiceError(
      "REPLAY_MEDIA_UNAVAILABLE",
      "Replay media is not available.",
      409,
    )
  }

  const isOwner = Boolean(input.userId && replay.userId === input.userId)
  const isDisplayDevice = Boolean(
    input.deviceId &&
      (await hasDisplayAssignmentForResource({
        tenantId: input.context.tenantId,
        deviceId: input.deviceId,
        resourceId: replay.resourceId,
      })),
  )

  if (!isOwner && !isDisplayDevice) {
    throw new ReplayServiceError(
      "REPLAY_FORBIDDEN",
      "You are not authorized to play this replay.",
      403,
    )
  }

  return {
    replay,
    isOwner,
    isDisplayDevice,
  }
}

export async function getReplayPlaybackGrant(input: {
  context: TenantContext
  replayId: string
  userId?: string
  deviceId?: string
}) {
  if (input.userId) {
    authorize(input.context, "account.read")
  }

  const { replay, isOwner } = await authorizeReplayPlayback(input)
  const mediaAssetId = replay.mediaAssetId

  if (!mediaAssetId) {
    throw new ReplayServiceError(
      "REPLAY_MEDIA_UNAVAILABLE",
      "Replay media is not available.",
      409,
    )
  }

  const grant =
    isOwner && input.userId
      ? await createPlaybackGrantForMediaAsset({
          context: input.context,
          userId: input.userId,
          mediaId: mediaAssetId,
        })
      : await createPlaybackGrantForReadyMedia({
          context: input.context,
          mediaId: mediaAssetId,
        })

  return {
    replayId: replay.id,
    mediaId: replay.mediaAssetId,
    grant,
  }
}

export async function getReplayDetailForUser(
  context: TenantContext,
  input: {
    replayId: string
    userId: string
  },
) {
  authorize(context, "account.read")

  const { replay } = await authorizeReplayPlayback({
    context,
    replayId: input.replayId,
    userId: input.userId,
  })

  if (replay.userId !== input.userId) {
    throw new ReplayServiceError(
      "REPLAY_FORBIDDEN",
      "You are not authorized to view this replay.",
      403,
    )
  }

  const playback = await getReplayPlaybackGrant({
    context,
    replayId: replay.id,
    userId: input.userId,
  })

  return {
    id: replay.id,
    title: metadataTitle(replay.metadata as Record<string, unknown> | null),
    status: replay.status,
    recordedAt: (replay.readyAt ?? replay.requestedAt).toISOString(),
    durationSeconds: REPLAY_CLIP_DURATION_SECONDS,
    bookingId: replay.bookingId,
    mediaId: replay.mediaAssetId,
    playbackUrl: playback.grant.url,
    playbackExpiresAt: playback.grant.expiresAt,
  }
}

export async function getDisplayReplayPlaybackGrant(input: {
  resourceId: string
  replayId: string
  correlationId?: string
}) {
  const [scoped] = await db
    .select({
      tenantId: replays.tenantId,
      id: replays.id,
      mediaAssetId: replays.mediaAssetId,
      status: replays.status,
      resourceId: playSessions.resourceId,
      playSessionCorrelationId: playSessions.correlationId,
      replayRequestCorrelationId: replayRequests.correlationId,
    })
    .from(replays)
    .leftJoin(playSessions, eq(replays.playSessionId, playSessions.id))
    .leftJoin(
      replayRequests,
      and(
        eq(replayRequests.replayId, replays.id),
        eq(replayRequests.tenantId, replays.tenantId),
      ),
    )
    .where(
      and(eq(replays.id, input.replayId), eq(playSessions.resourceId, input.resourceId)),
    )
    .limit(1)

  if (!scoped || scoped.status !== "ready" || !scoped.mediaAssetId) {
    throw new ReplayServiceError(
      "REPLAY_NOT_READY",
      "Replay is not ready for display playback.",
      409,
    )
  }

  const correlationId =
    input.correlationId ??
    scoped.replayRequestCorrelationId ??
    scoped.playSessionCorrelationId ??
    `display-playback:${scoped.id}`

  const context: TenantContext = {
    tenantId: scoped.tenantId,
    actor: { type: "service", id: "display-playback" },
    correlationId,
  }

  const grant = await createPlaybackGrantForReadyMedia({
    context,
    mediaId: scoped.mediaAssetId,
  })

  return {
    replayId: scoped.id,
    mediaId: scoped.mediaAssetId,
    grant,
  }
}
