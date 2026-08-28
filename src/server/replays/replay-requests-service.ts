import { randomUUID } from "node:crypto"

import { and, eq } from "drizzle-orm"

import db from "@/db/drizzle"
import {
  deviceCommands,
  devices,
  replayCreditBalances,
  replayCreditLedger,
  replays,
} from "@/db/schema"
import { DEFAULT_COMMAND_TTL_SECONDS } from "@/server/devices/health-policy"
import { MEDIA_UPLOAD_GRANT_TTL_SECONDS } from "@/server/media/constants"
import { resolveMediaContentPolicy } from "@/server/media/content-policy"
import { getMediaStore } from "@/server/media/factory"
import { isPrivateMediaEnabledForTenant } from "@/server/media/feature-policy"
import { buildMediaObjectKey } from "@/server/media/object-keys"
import { insertMediaAsset, getMediaAssetById } from "@/server/media/repository"
import {
  REPLAY_POST_ROLL_SECONDS,
  REPLAY_PRE_ROLL_SECONDS,
} from "@/server/replays/constants"
import { ReplayServiceError } from "@/server/replays/errors"
import { isReplayEdgeEnabledForTenant } from "@/server/replays/feature-policy"
import { buildCaptureReplayCommandPayload } from "@/server/replays/capture-replay-command"
import {
  getActivePlaySessionForReplayRequest,
  getActivePlaySessionOwnerForResource,
  getInFlightReplayRequestForSession,
  getLatestReplayRequestForSession,
  getReplayCreditBalance,
  getReplayRequestById,
  getReplayRequestByIdempotencyKey,
  getAppliedConfigRevisionIdForDevice,
  bumpReplayRequestAttempts,
  insertReplayRequest,
  listReplayRequestsForLocation,
  resolveVenueEdgeForResource,
  transitionReplayRequestStatus,
  type ReplayRequestRecord,
} from "@/server/replays/replay-requests-repository"
import {
  OPERATOR_CANCELABLE_REPLAY_REQUEST_STATUSES,
  OPERATOR_RETRYABLE_REPLAY_REQUEST_STATUSES,
} from "@/server/replays/constants"
import { getDisplaySnapshotForResource } from "@/server/realtime/display-query"
import { authorize } from "@/server/tenancy/authorize-context.mjs"
import { createServiceTenantContext } from "@/server/tenancy/context-factory"
import { createCorrelationId } from "@/server/tenancy/correlation"
import type { TenantContext } from "@/server/tenancy/types"

type DbExecutor = Parameters<Parameters<typeof db.transaction>[0]>[0]

const TERMINAL_CAPTURE_COMMAND_STATUSES = new Set([
  "failed",
  "expired",
  "cancelled",
  "acknowledged",
])

function captureCommandFailureReason(
  command: {
    status: string
    lastError: string | null
    result: unknown
  } | null,
): string {
  if (!command) {
    return "capture_command_missing"
  }

  if (
    command.result &&
    typeof command.result === "object" &&
    !Array.isArray(command.result) &&
    typeof (command.result as { reason?: unknown }).reason === "string"
  ) {
    return (command.result as { reason: string }).reason
  }

  if (command.status === "expired") {
    return "capture_command_expired"
  }

  return command.lastError ?? "capture_command_failed"
}

async function failReplayRequestIfCaptureCommandIsTerminal(
  context: TenantContext,
  replayRequest: ReplayRequestRecord,
): Promise<ReplayRequestRecord> {
  if (!replayRequest.deviceCommandId) {
    return replayRequest
  }

  const [command] = await db
    .select({
      status: deviceCommands.status,
      lastError: deviceCommands.lastError,
      result: deviceCommands.result,
    })
    .from(deviceCommands)
    .where(
      and(
        eq(deviceCommands.tenantId, context.tenantId),
        eq(deviceCommands.id, replayRequest.deviceCommandId),
      ),
    )
    .limit(1)

  if (!command || !TERMINAL_CAPTURE_COMMAND_STATUSES.has(command.status)) {
    return replayRequest
  }

  try {
    return await transitionReplayRequestStatus(context, {
      replayRequestId: replayRequest.id,
      toStatus: "failed",
      failureReason: captureCommandFailureReason(command),
    })
  } catch {
    return replayRequest
  }
}

async function buildExistingReplayRequestResult(
  context: TenantContext,
  userId: string,
  existing: ReplayRequestRecord
) {
  const remainingCredits = await getReplayCreditBalance(context, userId)

  return {
    replayRequestId: existing.id,
    replayId: existing.replayId,
    mediaAssetId: existing.mediaAssetId,
    status: existing.status,
    remainingCredits,
    correlationId: existing.correlationId,
  }
}

async function assertReplayEdgePrerequisites(
  context: TenantContext,
  scope?: { locationId?: string; resourceId?: string }
) {
  const [replayEdgeEnabled, privateMediaEnabled] = await Promise.all([
    isReplayEdgeEnabledForTenant(context, scope ?? {}),
    isPrivateMediaEnabledForTenant(context),
  ])

  if (!replayEdgeEnabled) {
    throw new ReplayServiceError(
      "REPLAY_EDGE_DISABLED",
      "Venue-edge replay capture is not enabled for this tenant.",
      503
    )
  }

  if (!privateMediaEnabled) {
    throw new ReplayServiceError(
      "PRIVATE_MEDIA_DISABLED",
      "Private media is required for venue-edge replay capture.",
      503
    )
  }
}

async function insertCaptureReplayCommand(
  input: {
    tenantId: string
    deviceId: string
    correlationId: string
    payload: Record<string, unknown>
  },
  tx: DbExecutor
) {
  const expiresAt = new Date(Date.now() + DEFAULT_COMMAND_TTL_SECONDS * 1000)

  const [command] = await tx
    .insert(deviceCommands)
    .values({
      tenantId: input.tenantId,
      deviceId: input.deviceId,
      kind: "capture_replay",
      payload: input.payload,
      expiresAt,
      correlationId: input.correlationId,
      maxAttempts: 3,
    })
    .returning()

  return command
}

export async function createReplayRequest(input: {
  context: TenantContext
  userId: string
  playSessionId: string
  clientIdempotencyKey: string
  requestSource?: string
}) {
  authorize(input.context, "booking.read")

  const session = await getActivePlaySessionForReplayRequest(input.context, {
    playSessionId: input.playSessionId,
    requesterUserId: input.userId,
  })

  if (!session) {
    throw new ReplayServiceError(
      "SESSION_NOT_ACTIVE",
      "Replay capture is only available during an active owned session with replay capability.",
      409
    )
  }

  await assertReplayEdgePrerequisites(input.context, {
    locationId: session.locationId,
    resourceId: session.resourceId,
  })

  const existing = await getReplayRequestByIdempotencyKey(input.context, {
    requesterUserId: input.userId,
    playSessionId: input.playSessionId,
    clientIdempotencyKey: input.clientIdempotencyKey,
  })

  if (existing) {
    return buildExistingReplayRequestResult(
      input.context,
      input.userId,
      existing
    )
  }

  const venueEdge = await resolveVenueEdgeForResource(
    input.context,
    session.resourceId
  )

  if (!venueEdge) {
    throw new ReplayServiceError(
      "VENUE_EDGE_UNAVAILABLE",
      "No venue edge device is assigned to this resource.",
      503
    )
  }

  const mediaId = randomUUID()
  const correlationId = input.context.correlationId || createCorrelationId()
  const captureAt = new Date()
  const objectKey = buildMediaObjectKey({
    tenantId: session.tenantId,
    locationId: session.locationId,
    resourceId: session.resourceId,
    playSessionId: session.id,
    mediaId,
    kind: "source_video",
  })
  const mediaPolicy = resolveMediaContentPolicy("source_video")

  const store = getMediaStore()
  let uploadGrant: { url: string; expiresAt: string; contentType?: string }

  try {
    uploadGrant = await store.createUploadGrant({
      objectKey,
      contentType: mediaPolicy.expectedContentType,
      maxBytes: mediaPolicy.expectedMaxBytes,
      expiresInSeconds: MEDIA_UPLOAD_GRANT_TTL_SECONDS,
    })
  } catch {
    throw new ReplayServiceError(
      "MEDIA_STORE_UNAVAILABLE",
      "Media storage is temporarily unavailable.",
      503
    )
  }

  return db.transaction(async (tx) => {
    const duplicate = await getReplayRequestByIdempotencyKey(
      input.context,
      {
        requesterUserId: input.userId,
        playSessionId: input.playSessionId,
        clientIdempotencyKey: input.clientIdempotencyKey,
      },
      tx
    )

    if (duplicate) {
      return buildExistingReplayRequestResult(
        input.context,
        input.userId,
        duplicate
      )
    }

    const [device] = await tx
      .select({ status: devices.status })
      .from(devices)
      .where(
        and(
          eq(devices.tenantId, input.context.tenantId),
          eq(devices.id, venueEdge.deviceId)
        )
      )
      .limit(1)

    if (!device || device.status === "revoked") {
      throw new ReplayServiceError(
        "VENUE_EDGE_UNAVAILABLE",
        "Venue edge device is not available.",
        503
      )
    }

    const configRevisionId = await getAppliedConfigRevisionIdForDevice(
      input.context,
      session.locationId,
      venueEdge.deviceId,
      tx
    )

    if (!configRevisionId) {
      throw new ReplayServiceError(
        "EDGE_CONFIG_NOT_READY",
        "VenueEdge configuration has not been published for this venue.",
        503
      )
    }

    await tx
      .insert(replayCreditBalances)
      .values({
        tenantId: input.context.tenantId,
        userId: input.userId,
        balance: 0,
      })
      .onConflictDoNothing()

    const [balanceRow] = await tx
      .select()
      .from(replayCreditBalances)
      .where(
        and(
          eq(replayCreditBalances.tenantId, input.context.tenantId),
          eq(replayCreditBalances.userId, input.userId)
        )
      )
      .for("update")
      .limit(1)

    const balance = balanceRow?.balance ?? 0

    if (balance <= 0) {
      throw new ReplayServiceError(
        "NO_CREDITS",
        "You need clip credits to capture a highlight. Buy a clip pack in the app.",
        402
      )
    }

    await insertMediaAsset(
      {
        id: mediaId,
        tenantId: session.tenantId,
        locationId: session.locationId,
        resourceId: session.resourceId,
        playSessionId: session.id,
        ownerUserId: input.userId,
        objectKey,
        kind: "source_video",
        expectedContentType: mediaPolicy.expectedContentType,
        expectedMaxBytes: mediaPolicy.expectedMaxBytes,
        retentionClass: "replay_standard",
      },
      tx
    )

    const [replay] = await tx
      .insert(replays)
      .values({
        tenantId: session.tenantId,
        bookingId: session.bookingId,
        playSessionId: session.id,
        locationId: session.locationId,
        userId: input.userId,
        mediaAssetId: mediaId,
        status: "queued",
        metadata: {
          source: input.requestSource ?? "replay_edge",
          replayRequestCorrelationId: correlationId,
        },
      })
      .returning()

    await tx.insert(replayCreditLedger).values({
      tenantId: input.context.tenantId,
      userId: input.userId,
      delta: -1,
      reason: "replay_capture",
      bookingId: session.bookingId,
      replayId: replay.id,
    })

    await tx
      .update(replayCreditBalances)
      .set({ balance: balance - 1, updatedAt: new Date() })
      .where(
        and(
          eq(replayCreditBalances.tenantId, input.context.tenantId),
          eq(replayCreditBalances.userId, input.userId)
        )
      )

    const replayRequest = await insertReplayRequest(
      {
        tenantId: session.tenantId,
        locationId: session.locationId,
        resourceId: session.resourceId,
        playSessionId: session.id,
        bookingId: session.bookingId,
        requesterUserId: input.userId,
        replayId: replay.id,
        mediaAssetId: mediaId,
        venueEdgeDeviceId: venueEdge.deviceId,
        cameraDeviceId: venueEdge.cameraDeviceId,
        assignmentId: venueEdge.assignmentId,
        configRevisionId,
        sourceType: "edge_buffer",
        captureAt,
        preRollSeconds: REPLAY_PRE_ROLL_SECONDS,
        postRollSeconds: REPLAY_POST_ROLL_SECONDS,
        status: "authorized",
        correlationId,
        clientIdempotencyKey: input.clientIdempotencyKey,
      },
      tx
    )

    const command = await insertCaptureReplayCommand(
      {
        tenantId: session.tenantId,
        deviceId: venueEdge.deviceId,
        correlationId,
        payload: buildCaptureReplayCommandPayload({
          replayRequestId: replayRequest.id,
          replayId: replay.id,
          mediaAssetId: mediaId,
          objectKey,
          captureAt: captureAt.toISOString(),
          preRollSeconds: REPLAY_PRE_ROLL_SECONDS,
          postRollSeconds: REPLAY_POST_ROLL_SECONDS,
          sourceType: "edge_buffer",
          resourceId: session.resourceId,
          playSessionId: session.id,
          configRevisionId,
          uploadGrant,
        }),
      },
      tx
    )

    const dispatched = await transitionReplayRequestStatus(
      input.context,
      {
        replayRequestId: replayRequest.id,
        toStatus: "dispatched",
        deviceCommandId: command.id,
      },
      tx
    )

    return {
      replayRequestId: dispatched.id,
      replayId: replay.id,
      mediaAssetId: mediaId,
      status: dispatched.status,
      remainingCredits: balance - 1,
      correlationId,
    }
  })
}

export async function getKioskReplayStatus(resourceId: string) {
  const snapshot = await getDisplaySnapshotForResource(resourceId)

  if (!snapshot) {
    return null
  }

  const context = createServiceTenantContext({
    tenantId: snapshot.resource.tenantId,
    actorId: "kiosk-replay",
    correlationId: createCorrelationId(),
  })

  if (snapshot.status === "idle") {
    return {
      status: "idle" as const,
      resource: {
        id: snapshot.resource.id,
        name: snapshot.resource.name,
        code: snapshot.resource.code,
      },
      playSession: null,
      remainingCredits: null,
      inFlightReplayRequestId: null,
      latestReplay: null,
    }
  }

  const sessionOwner = await getActivePlaySessionOwnerForResource(
    context,
    resourceId
  )
  const remainingCredits = sessionOwner
    ? await getReplayCreditBalance(context, sessionOwner.ownerUserId)
    : null
  let inFlight = await getInFlightReplayRequestForSession(
    context,
    snapshot.playSession.id
  )
  if (inFlight) {
    const maybeFailed = await failReplayRequestIfCaptureCommandIsTerminal(
      context,
      inFlight,
    )
    inFlight = maybeFailed.status === "failed" ? null : maybeFailed
  }
  const latest = await getLatestReplayRequestForSession(
    context,
    snapshot.playSession.id
  )

  return {
    status: "active" as const,
    resource: {
      id: snapshot.resource.id,
      name: snapshot.resource.name,
      code: snapshot.resource.code,
    },
    playSession: {
      id: snapshot.playSession.id,
    },
    remainingCredits,
    inFlightReplayRequestId: inFlight?.id ?? null,
    latestReplay: latest
      ? {
          id: latest.id,
          status: latest.status,
          failureReason: latest.failureReason,
        }
      : null,
  }
}

export async function createKioskReplayRequest(input: {
  resourceId: string
  clientIdempotencyKey: string
}) {
  const snapshot = await getDisplaySnapshotForResource(input.resourceId)

  if (!snapshot) {
    throw new ReplayServiceError(
      "RESOURCE_NOT_FOUND",
      "We could not find that resource.",
      404
    )
  }

  const context = createServiceTenantContext({
    tenantId: snapshot.resource.tenantId,
    actorId: "kiosk-replay",
    correlationId: createCorrelationId(),
  })

  const sessionOwner = await getActivePlaySessionOwnerForResource(
    context,
    input.resourceId
  )

  if (!sessionOwner) {
    throw new ReplayServiceError(
      "SESSION_NOT_ACTIVE",
      "Replay capture is only available during an active booking with replay capability.",
      409
    )
  }

  const inFlight = await getInFlightReplayRequestForSession(
    context,
    sessionOwner.playSessionId
  )

  if (inFlight) {
    throw new ReplayServiceError(
      "REPLAY_IN_FLIGHT",
      "A replay capture is already in progress for this table.",
      429
    )
  }

  return createReplayRequest({
    context,
    userId: sessionOwner.ownerUserId,
    playSessionId: sessionOwner.playSessionId,
    clientIdempotencyKey: input.clientIdempotencyKey,
    requestSource: "table_kiosk",
  })
}

export async function updateReplayRequestProgressFromEdge(input: {
  tenantId: string
  deviceId: string
  replayRequestId: string
  toStatus: ReplayRequestRecord["status"]
  failureReason?: string | null
}) {
  const context: TenantContext = {
    tenantId: input.tenantId,
    actor: { type: "device", id: input.deviceId },
    correlationId: createCorrelationId(),
  }

  const { getReplayRequestById } =
    await import("@/server/replays/replay-requests-repository")

  const replayRequest = await getReplayRequestById(
    context,
    input.replayRequestId
  )

  if (!replayRequest) {
    throw new ReplayServiceError(
      "REPLAY_REQUEST_NOT_FOUND",
      "Replay request was not found.",
      404
    )
  }

  if (replayRequest.venueEdgeDeviceId !== input.deviceId) {
    throw new ReplayServiceError(
      "REPLAY_REQUEST_FORBIDDEN",
      "This replay request is not assigned to the authenticated device.",
      403
    )
  }

  return transitionReplayRequestStatus(context, {
    replayRequestId: input.replayRequestId,
    toStatus: input.toStatus,
    failureReason: input.failureReason,
  })
}

export async function listReplayRequestsForOperator(
  context: TenantContext,
  locationId: string
) {
  authorize(context, "venue.read")
  return listReplayRequestsForLocation(context, locationId)
}

export async function retryReplayRequestForOperator(
  context: TenantContext,
  replayRequestId: string
) {
  authorize(context, "venue.manage")

  const replayRequest = await getReplayRequestById(context, replayRequestId)

  if (!replayRequest) {
    throw new ReplayServiceError(
      "REPLAY_REQUEST_NOT_FOUND",
      "Replay request was not found.",
      404
    )
  }

  if (
    !(OPERATOR_RETRYABLE_REPLAY_REQUEST_STATUSES as readonly string[]).includes(
      replayRequest.status
    )
  ) {
    throw new ReplayServiceError(
      "REPLAY_RETRY_NOT_ALLOWED",
      `Replay request cannot be retried from status ${replayRequest.status}.`,
      409
    )
  }

  if (replayRequest.attempts >= replayRequest.maxAttempts) {
    throw new ReplayServiceError(
      "REPLAY_MAX_ATTEMPTS",
      "Replay request has reached the maximum retry attempts.",
      409
    )
  }

  const venueEdge = await resolveVenueEdgeForResource(
    context,
    replayRequest.resourceId
  )

  if (!venueEdge) {
    throw new ReplayServiceError(
      "VENUE_EDGE_UNAVAILABLE",
      "No venue edge device is assigned to this resource.",
      503
    )
  }

  const asset = await getMediaAssetById(context, replayRequest.mediaAssetId)

  if (!asset) {
    throw new ReplayServiceError(
      "MEDIA_ASSET_NOT_FOUND",
      "Replay media asset was not found.",
      404
    )
  }

  const configRevisionId = replayRequest.configRevisionId

  if (!configRevisionId) {
    throw new ReplayServiceError(
      "EDGE_CONFIG_REVISION_MISSING",
      "Replay request is not bound to an immutable VenueEdge configuration revision.",
      409
    )
  }

  const store = getMediaStore()
  const uploadGrant = await store.createUploadGrant({
    objectKey: asset.objectKey,
    contentType: asset.expectedContentType,
    maxBytes: asset.expectedMaxBytes,
    expiresInSeconds: MEDIA_UPLOAD_GRANT_TTL_SECONDS,
  })

  return db.transaction(async (tx) => {
    await bumpReplayRequestAttempts(context, replayRequestId, tx)

    const correlationId = createCorrelationId()
    const command = await insertCaptureReplayCommand(
      {
        tenantId: context.tenantId,
        deviceId: venueEdge.deviceId,
        correlationId,
        payload: buildCaptureReplayCommandPayload({
          replayRequestId: replayRequest.id,
          replayId: replayRequest.replayId,
          mediaAssetId: replayRequest.mediaAssetId,
          objectKey: asset.objectKey,
          captureAt: replayRequest.captureAt.toISOString(),
          preRollSeconds: replayRequest.preRollSeconds,
          postRollSeconds: replayRequest.postRollSeconds,
          sourceType: replayRequest.sourceType,
          resourceId: replayRequest.resourceId,
          playSessionId: replayRequest.playSessionId,
          configRevisionId,
          uploadGrant: {
            url: uploadGrant.url,
            expiresAt: uploadGrant.expiresAt,
            contentType: uploadGrant.contentType,
          },
        }),
      },
      tx
    )

    const updated = await transitionReplayRequestStatus(
      context,
      {
        replayRequestId,
        toStatus: "dispatched",
        deviceCommandId: command.id,
        failureReason: null,
      },
      tx
    )

    return { replayRequest: updated, commandId: command.id }
  })
}

export async function cancelReplayRequestForOperator(
  context: TenantContext,
  replayRequestId: string,
  failureReason = "operator_cancelled"
) {
  authorize(context, "venue.manage")

  const replayRequest = await getReplayRequestById(context, replayRequestId)

  if (!replayRequest) {
    throw new ReplayServiceError(
      "REPLAY_REQUEST_NOT_FOUND",
      "Replay request was not found.",
      404
    )
  }

  if (
    !(
      OPERATOR_CANCELABLE_REPLAY_REQUEST_STATUSES as readonly string[]
    ).includes(replayRequest.status)
  ) {
    throw new ReplayServiceError(
      "REPLAY_CANCEL_NOT_ALLOWED",
      `Replay request cannot be cancelled from status ${replayRequest.status}.`,
      409
    )
  }

  const updated = await transitionReplayRequestStatus(context, {
    replayRequestId,
    toStatus: "failed",
    failureReason,
  })

  return { replayRequest: updated }
}
