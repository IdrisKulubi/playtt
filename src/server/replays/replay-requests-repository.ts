import { and, desc, eq, gt, isNull, lte, notInArray, or } from "drizzle-orm"

import db from "@/db/drizzle"
import {
  bookings,
  deviceAssignments,
  devices,
  playSessions,
  replayCreditBalances,
  replayRequests,
  resourceCapabilities,
  sessionParticipants,
} from "@/db/schema"
import type {
  replayCaptureSourceEnum,
  replayRequestStatusEnum,
} from "@/db/schema"
import { ReplayServiceError } from "@/server/replays/errors"
import type { TenantContext } from "@/server/tenancy/types"

type DbExecutor = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0]

export type ReplayRequestStatus =
  (typeof replayRequestStatusEnum.enumValues)[number]

export type ReplayCaptureSource =
  (typeof replayCaptureSourceEnum.enumValues)[number]

export interface ReplayRequestRecord {
  id: string
  tenantId: string
  locationId: string
  resourceId: string
  playSessionId: string
  bookingId: string
  requesterUserId: string
  replayId: string
  mediaAssetId: string
  venueEdgeDeviceId: string | null
  cameraDeviceId: string | null
  assignmentId: string | null
  sourceType: ReplayCaptureSource
  captureAt: Date
  preRollSeconds: number
  postRollSeconds: number
  status: ReplayRequestStatus
  attempts: number
  maxAttempts: number
  correlationId: string
  clientIdempotencyKey: string
  deviceCommandId: string | null
  failureReason: string | null
  dispatchedAt: Date | null
  edgeAcknowledgedAt: Date | null
  capturingAt: Date | null
  extractingAt: Date | null
  uploadingAt: Date | null
  verifyingAt: Date | null
  readyAt: Date | null
  failedAt: Date | null
  expiredAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface ActivePlaySessionForReplay {
  id: string
  tenantId: string
  bookingId: string
  locationId: string
  resourceId: string
  status: string
  bookingUserId: string
}

export interface ActivePlaySessionOwnerForResource {
  playSessionId: string
  tenantId: string
  bookingId: string
  locationId: string
  resourceId: string
  ownerUserId: string
}

const TERMINAL_REPLAY_REQUEST_STATUSES: ReplayRequestStatus[] = [
  "ready",
  "failed",
  "expired",
]

export interface VenueEdgeAssignment {
  deviceId: string
  assignmentId: string
  cameraDeviceId: string | null
}

const ALLOWED_REPLAY_REQUEST_TRANSITIONS: Record<
  ReplayRequestStatus,
  readonly ReplayRequestStatus[]
> = {
  requested: ["authorized", "failed"],
  authorized: ["dispatched", "failed", "edge_offline"],
  dispatched: [
    "edge_acknowledged",
    "edge_offline",
    "failed",
    "expired",
  ],
  edge_acknowledged: ["capturing", "edge_offline", "failed"],
  capturing: ["extracting", "buffer_missing", "failed"],
  extracting: ["uploading", "extraction_failed", "failed"],
  uploading: ["verifying", "upload_failed", "failed"],
  verifying: ["ready", "upload_failed", "failed"],
  ready: [],
  edge_offline: ["dispatched", "failed", "expired"],
  buffer_missing: ["capturing", "failed", "expired"],
  extraction_failed: ["extracting", "failed", "expired"],
  upload_failed: ["uploading", "failed", "expired"],
  expired: [],
  failed: [],
}

const STATUS_TIMESTAMP_FIELD: Partial<
  Record<ReplayRequestStatus, keyof ReplayRequestRecord>
> = {
  dispatched: "dispatchedAt",
  edge_acknowledged: "edgeAcknowledgedAt",
  capturing: "capturingAt",
  extracting: "extractingAt",
  uploading: "uploadingAt",
  verifying: "verifyingAt",
  ready: "readyAt",
  failed: "failedAt",
  expired: "expiredAt",
}

function mapReplayRequest(
  row: typeof replayRequests.$inferSelect,
): ReplayRequestRecord {
  return {
    id: row.id,
    tenantId: row.tenantId,
    locationId: row.locationId,
    resourceId: row.resourceId,
    playSessionId: row.playSessionId,
    bookingId: row.bookingId,
    requesterUserId: row.requesterUserId,
    replayId: row.replayId,
    mediaAssetId: row.mediaAssetId,
    venueEdgeDeviceId: row.venueEdgeDeviceId,
    cameraDeviceId: row.cameraDeviceId,
    assignmentId: row.assignmentId,
    sourceType: row.sourceType,
    captureAt: row.captureAt,
    preRollSeconds: row.preRollSeconds,
    postRollSeconds: row.postRollSeconds,
    status: row.status,
    attempts: row.attempts,
    maxAttempts: row.maxAttempts,
    correlationId: row.correlationId,
    clientIdempotencyKey: row.clientIdempotencyKey,
    deviceCommandId: row.deviceCommandId,
    failureReason: row.failureReason,
    dispatchedAt: row.dispatchedAt,
    edgeAcknowledgedAt: row.edgeAcknowledgedAt,
    capturingAt: row.capturingAt,
    extractingAt: row.extractingAt,
    uploadingAt: row.uploadingAt,
    verifyingAt: row.verifyingAt,
    readyAt: row.readyAt,
    failedAt: row.failedAt,
    expiredAt: row.expiredAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export async function getReplayRequestByIdempotencyKey(
  context: TenantContext,
  input: {
    requesterUserId: string
    playSessionId: string
    clientIdempotencyKey: string
  },
  tx?: DbExecutor,
) {
  const executor = tx ?? db
  const [row] = await executor
    .select()
    .from(replayRequests)
    .where(
      and(
        eq(replayRequests.tenantId, context.tenantId),
        eq(replayRequests.requesterUserId, input.requesterUserId),
        eq(replayRequests.playSessionId, input.playSessionId),
        eq(replayRequests.clientIdempotencyKey, input.clientIdempotencyKey),
      ),
    )
    .limit(1)

  return row ? mapReplayRequest(row) : null
}

export async function getReplayRequestByMediaAssetId(
  context: TenantContext,
  mediaAssetId: string,
  tx?: DbExecutor,
) {
  const executor = tx ?? db
  const [row] = await executor
    .select()
    .from(replayRequests)
    .where(
      and(
        eq(replayRequests.tenantId, context.tenantId),
        eq(replayRequests.mediaAssetId, mediaAssetId),
      ),
    )
    .limit(1)

  return row ? mapReplayRequest(row) : null
}

export async function getReplayRequestById(
  context: TenantContext,
  replayRequestId: string,
  tx?: DbExecutor,
) {
  const executor = tx ?? db
  const [row] = await executor
    .select()
    .from(replayRequests)
    .where(
      and(
        eq(replayRequests.tenantId, context.tenantId),
        eq(replayRequests.id, replayRequestId),
      ),
    )
    .limit(1)

  return row ? mapReplayRequest(row) : null
}

export async function insertReplayRequest(
  input: {
    tenantId: string
    locationId: string
    resourceId: string
    playSessionId: string
    bookingId: string
    requesterUserId: string
    replayId: string
    mediaAssetId: string
    venueEdgeDeviceId: string
    cameraDeviceId?: string | null
    assignmentId: string
    sourceType: ReplayCaptureSource
    captureAt: Date
    preRollSeconds: number
    postRollSeconds: number
    status: ReplayRequestStatus
    correlationId: string
    clientIdempotencyKey: string
    deviceCommandId?: string | null
    dispatchedAt?: Date | null
  },
  tx?: DbExecutor,
) {
  const executor = tx ?? db
  const [row] = await executor
    .insert(replayRequests)
    .values({
      tenantId: input.tenantId,
      locationId: input.locationId,
      resourceId: input.resourceId,
      playSessionId: input.playSessionId,
      bookingId: input.bookingId,
      requesterUserId: input.requesterUserId,
      replayId: input.replayId,
      mediaAssetId: input.mediaAssetId,
      venueEdgeDeviceId: input.venueEdgeDeviceId,
      cameraDeviceId: input.cameraDeviceId ?? null,
      assignmentId: input.assignmentId,
      sourceType: input.sourceType,
      captureAt: input.captureAt,
      preRollSeconds: input.preRollSeconds,
      postRollSeconds: input.postRollSeconds,
      status: input.status,
      correlationId: input.correlationId,
      clientIdempotencyKey: input.clientIdempotencyKey,
      deviceCommandId: input.deviceCommandId ?? null,
      dispatchedAt: input.dispatchedAt ?? null,
    })
    .returning()

  return mapReplayRequest(row!)
}

export async function transitionReplayRequestStatus(
  context: TenantContext,
  input: {
    replayRequestId: string
    toStatus: ReplayRequestStatus
    failureReason?: string | null
    deviceCommandId?: string | null
  },
  tx?: DbExecutor,
) {
  const executor = tx ?? db
  const [current] = await executor
    .select()
    .from(replayRequests)
    .where(
      and(
        eq(replayRequests.tenantId, context.tenantId),
        eq(replayRequests.id, input.replayRequestId),
      ),
    )
    .limit(1)
    .for("update")

  if (!current) {
    throw new ReplayServiceError(
      "REPLAY_REQUEST_NOT_FOUND",
      "Replay request was not found.",
      404,
    )
  }

  if (current.status === input.toStatus) {
    return mapReplayRequest(current)
  }

  const allowed = ALLOWED_REPLAY_REQUEST_TRANSITIONS[current.status] ?? []

  if (!allowed.includes(input.toStatus)) {
    throw new ReplayServiceError(
      "INVALID_REPLAY_REQUEST_TRANSITION",
      `Cannot transition replay request from ${current.status} to ${input.toStatus}.`,
      409,
    )
  }

  const now = new Date()
  const timestampField = STATUS_TIMESTAMP_FIELD[input.toStatus]
  const timestampUpdate = timestampField
    ? { [timestampField]: now }
    : {}

  const [updated] = await executor
    .update(replayRequests)
    .set({
      status: input.toStatus,
      failureReason:
        input.failureReason !== undefined
          ? input.failureReason
          : current.failureReason,
      deviceCommandId:
        input.deviceCommandId !== undefined
          ? input.deviceCommandId
          : current.deviceCommandId,
      ...timestampUpdate,
      updatedAt: now,
    })
    .where(
      and(
        eq(replayRequests.tenantId, context.tenantId),
        eq(replayRequests.id, input.replayRequestId),
        eq(replayRequests.status, current.status),
      ),
    )
    .returning()

  if (!updated) {
    throw new ReplayServiceError(
      "REPLAY_REQUEST_STATE_CHANGED",
      "Replay request changed before the status update.",
      409,
    )
  }

  return mapReplayRequest(updated)
}

export async function getInFlightReplayRequestForSession(
  context: TenantContext,
  playSessionId: string,
  tx?: DbExecutor,
) {
  const executor = tx ?? db
  const [row] = await executor
    .select()
    .from(replayRequests)
    .where(
      and(
        eq(replayRequests.tenantId, context.tenantId),
        eq(replayRequests.playSessionId, playSessionId),
        notInArray(replayRequests.status, TERMINAL_REPLAY_REQUEST_STATUSES),
      ),
    )
    .orderBy(desc(replayRequests.createdAt))
    .limit(1)

  return row ? mapReplayRequest(row) : null
}

export async function getActivePlaySessionOwnerForResource(
  context: TenantContext,
  resourceId: string,
) {
  const now = new Date()

  const [row] = await db
    .select({
      playSessionId: playSessions.id,
      tenantId: playSessions.tenantId,
      bookingId: playSessions.bookingId,
      locationId: playSessions.locationId,
      resourceId: playSessions.resourceId,
      bookingStatus: bookings.status,
      paymentStatus: bookings.paymentStatus,
      startTime: bookings.startTime,
      endTime: bookings.endTime,
      ownerUserId: sessionParticipants.userId,
      replayCapabilityId: resourceCapabilities.id,
    })
    .from(playSessions)
    .innerJoin(bookings, eq(playSessions.bookingId, bookings.id))
    .innerJoin(
      sessionParticipants,
      and(
        eq(sessionParticipants.playSessionId, playSessions.id),
        eq(sessionParticipants.role, "owner"),
      ),
    )
    .innerJoin(
      resourceCapabilities,
      and(
        eq(resourceCapabilities.resourceId, playSessions.resourceId),
        eq(resourceCapabilities.tenantId, playSessions.tenantId),
        eq(resourceCapabilities.code, "replay"),
      ),
    )
    .where(
      and(
        eq(playSessions.tenantId, context.tenantId),
        eq(bookings.tenantId, context.tenantId),
        eq(sessionParticipants.tenantId, context.tenantId),
        eq(resourceCapabilities.tenantId, context.tenantId),
        eq(playSessions.resourceId, resourceId),
        eq(playSessions.status, "active"),
      ),
    )
    .limit(1)

  if (!row) {
    return null
  }

  if (row.bookingStatus !== "confirmed" || row.paymentStatus !== "paid") {
    return null
  }

  if (row.startTime > now || row.endTime < now) {
    return null
  }

  return {
    playSessionId: row.playSessionId,
    tenantId: row.tenantId,
    bookingId: row.bookingId,
    locationId: row.locationId,
    resourceId: row.resourceId,
    ownerUserId: row.ownerUserId,
  } satisfies ActivePlaySessionOwnerForResource
}

export async function getActivePlaySessionForReplayRequest(
  context: TenantContext,
  input: {
    playSessionId: string
    requesterUserId: string
  },
) {
  const now = new Date()

  const [row] = await db
    .select({
      id: playSessions.id,
      tenantId: playSessions.tenantId,
      bookingId: playSessions.bookingId,
      locationId: playSessions.locationId,
      resourceId: playSessions.resourceId,
      status: playSessions.status,
      bookingUserId: bookings.userId,
      bookingStatus: bookings.status,
      paymentStatus: bookings.paymentStatus,
      startTime: bookings.startTime,
      endTime: bookings.endTime,
      participantRole: sessionParticipants.role,
      replayCapabilityId: resourceCapabilities.id,
    })
    .from(playSessions)
    .innerJoin(bookings, eq(playSessions.bookingId, bookings.id))
    .innerJoin(
      sessionParticipants,
      and(
        eq(sessionParticipants.playSessionId, playSessions.id),
        eq(sessionParticipants.userId, input.requesterUserId),
      ),
    )
    .innerJoin(
      resourceCapabilities,
      and(
        eq(resourceCapabilities.resourceId, playSessions.resourceId),
        eq(resourceCapabilities.tenantId, playSessions.tenantId),
        eq(resourceCapabilities.code, "replay"),
      ),
    )
    .where(
      and(
        eq(playSessions.tenantId, context.tenantId),
        eq(bookings.tenantId, context.tenantId),
        eq(sessionParticipants.tenantId, context.tenantId),
        eq(resourceCapabilities.tenantId, context.tenantId),
        eq(playSessions.id, input.playSessionId),
        eq(playSessions.status, "active"),
        eq(sessionParticipants.role, "owner"),
      ),
    )
    .limit(1)

  if (!row) {
    return null
  }

  if (row.bookingStatus !== "confirmed" || row.paymentStatus !== "paid") {
    return null
  }

  if (row.startTime > now || row.endTime < now) {
    return null
  }

  return {
    id: row.id,
    tenantId: row.tenantId,
    bookingId: row.bookingId,
    locationId: row.locationId,
    resourceId: row.resourceId,
    status: row.status,
    bookingUserId: row.bookingUserId,
  } satisfies ActivePlaySessionForReplay
}

export async function resolveVenueEdgeForResource(
  context: TenantContext,
  resourceId: string,
  at: Date = new Date(),
): Promise<VenueEdgeAssignment | null> {
  const [row] = await db
    .select({
      deviceId: devices.id,
      assignmentId: deviceAssignments.id,
      cameraDeviceId: deviceAssignments.config,
    })
    .from(deviceAssignments)
    .innerJoin(
      devices,
      and(
        eq(devices.id, deviceAssignments.deviceId),
        eq(devices.tenantId, deviceAssignments.tenantId),
      ),
    )
    .where(
      and(
        eq(deviceAssignments.tenantId, context.tenantId),
        eq(deviceAssignments.resourceId, resourceId),
        eq(deviceAssignments.role, "venue_edge"),
        eq(devices.type, "venue_edge"),
        lte(deviceAssignments.effectiveFrom, at),
        or(
          isNull(deviceAssignments.effectiveTo),
          gt(deviceAssignments.effectiveTo, at),
        ),
      ),
    )
    .orderBy(desc(deviceAssignments.effectiveFrom))
    .limit(1)

  if (!row) {
    return null
  }

  const config = row.cameraDeviceId as Record<string, unknown> | null
  const cameraDeviceId =
    typeof config?.cameraDeviceId === "string" ? config.cameraDeviceId : null

  return {
    deviceId: row.deviceId,
    assignmentId: row.assignmentId,
    cameraDeviceId,
  }
}

export async function getReplayCreditBalance(
  context: TenantContext,
  userId: string,
  tx?: DbExecutor,
) {
  const executor = tx ?? db
  const [row] = await executor
    .select({ balance: replayCreditBalances.balance })
    .from(replayCreditBalances)
    .where(
      and(
        eq(replayCreditBalances.tenantId, context.tenantId),
        eq(replayCreditBalances.userId, userId),
      ),
    )
    .limit(1)

  return row?.balance ?? 0
}
