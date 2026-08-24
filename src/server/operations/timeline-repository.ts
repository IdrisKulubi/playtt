import { and, eq, inArray, or } from "drizzle-orm"

import db from "@/db/drizzle"
import {
  auditLogs,
  bookings,
  deviceCommands,
  locations,
  mediaAssets,
  outboxEvents,
  payments,
  playSessions,
  replayRequests,
  resources,
  sessionEvents,
  user,
} from "@/db/schema"
import { buildConfirmationCorrelationId } from "@/server/operations/timeline-types"
import type { TenantContext } from "@/server/tenancy/types"

export interface BookingTimelineHeader {
  id: string
  locationId: string
  locationName: string
  resourceId: string
  resourceName: string
  userId: string
  userName: string
  userEmail: string
  status: string
  paymentStatus: string
  startTime: string
  endTime: string
  totalAmount: string
  currency: string
  confirmedAt: string | null
  createdAt: string
}

export interface BookingTimelineRawData {
  header: BookingTimelineHeader
  payments: Array<{
    id: string
    status: string
    providerReference: string
    createdAt: string
    paidAt: string | null
  }>
  playSession: {
    id: string
    status: string
    correlationId: string
    createdAt: string
    preparedAt: string | null
    startedAt: string | null
    endedAt: string | null
    completedAt: string | null
    resetAt: string | null
  } | null
  outboxEvents: Array<{
    id: string
    eventType: string
    status: string
    aggregateType: string
    aggregateId: string
    correlationId: string
    createdAt: string
    processedAt: string | null
    lastError: string | null
  }>
  auditLogs: Array<{
    id: string
    action: string
    targetType: string | null
    targetId: string | null
    correlationId: string | null
    createdAt: string
    metadata: Record<string, unknown> | null
  }>
  replayRequests: Array<{
    id: string
    status: string
    correlationId: string
    failureReason: string | null
    deviceCommandId: string | null
    mediaAssetId: string
    createdAt: string
    dispatchedAt: string | null
    edgeAcknowledgedAt: string | null
    capturingAt: string | null
    extractingAt: string | null
    uploadingAt: string | null
    verifyingAt: string | null
    readyAt: string | null
    failedAt: string | null
    expiredAt: string | null
  }>
  deviceCommands: Array<{
    id: string
    kind: string
    status: string
    correlationId: string
    createdAt: string
    deliveredAt: string | null
    acknowledgedAt: string | null
    failedAt: string | null
    lastError: string | null
  }>
  mediaAssets: Array<{
    id: string
    status: string
    createdAt: string
    uploadedAt: string | null
    readyAt: string | null
  }>
  sessionEvents: Array<{
    id: string
    eventType: string
    status: string
    createdAt: string
    triggeredAt: string | null
  }>
}

export async function fetchBookingTimelineRawData(
  context: TenantContext,
  bookingId: string,
): Promise<BookingTimelineRawData | null> {
  const [headerRow] = await db
    .select({
      booking: bookings,
      locationName: locations.name,
      resourceName: resources.name,
      userName: user.name,
      userEmail: user.email,
    })
    .from(bookings)
    .innerJoin(locations, eq(bookings.locationId, locations.id))
    .innerJoin(resources, eq(bookings.resourceId, resources.id))
    .innerJoin(user, eq(bookings.userId, user.id))
    .where(
      and(
        eq(bookings.tenantId, context.tenantId),
        eq(bookings.id, bookingId),
      ),
    )
    .limit(1)

  if (!headerRow) {
    return null
  }

  const header: BookingTimelineHeader = {
    id: headerRow.booking.id,
    locationId: headerRow.booking.locationId,
    locationName: headerRow.locationName,
    resourceId: headerRow.booking.resourceId,
    resourceName: headerRow.resourceName,
    userId: headerRow.booking.userId,
    userName: headerRow.userName,
    userEmail: headerRow.userEmail,
    status: headerRow.booking.status,
    paymentStatus: headerRow.booking.paymentStatus,
    startTime: headerRow.booking.startTime.toISOString(),
    endTime: headerRow.booking.endTime.toISOString(),
    totalAmount: headerRow.booking.totalAmount,
    currency: headerRow.booking.currency,
    confirmedAt: headerRow.booking.confirmedAt?.toISOString() ?? null,
    createdAt: headerRow.booking.createdAt.toISOString(),
  }

  const [paymentRows, playSessionRow, replayRequestRows, sessionEventRows] =
    await Promise.all([
      db
        .select({
          id: payments.id,
          status: payments.status,
          providerReference: payments.providerReference,
          createdAt: payments.createdAt,
          paidAt: payments.paidAt,
        })
        .from(payments)
        .where(
          and(
            eq(payments.tenantId, context.tenantId),
            eq(payments.bookingId, bookingId),
          ),
        ),
      db
        .select()
        .from(playSessions)
        .where(
          and(
            eq(playSessions.tenantId, context.tenantId),
            eq(playSessions.bookingId, bookingId),
          ),
        )
        .limit(1),
      db
        .select({
          id: replayRequests.id,
          status: replayRequests.status,
          correlationId: replayRequests.correlationId,
          failureReason: replayRequests.failureReason,
          deviceCommandId: replayRequests.deviceCommandId,
          mediaAssetId: replayRequests.mediaAssetId,
          createdAt: replayRequests.createdAt,
          dispatchedAt: replayRequests.dispatchedAt,
          edgeAcknowledgedAt: replayRequests.edgeAcknowledgedAt,
          capturingAt: replayRequests.capturingAt,
          extractingAt: replayRequests.extractingAt,
          uploadingAt: replayRequests.uploadingAt,
          verifyingAt: replayRequests.verifyingAt,
          readyAt: replayRequests.readyAt,
          failedAt: replayRequests.failedAt,
          expiredAt: replayRequests.expiredAt,
        })
        .from(replayRequests)
        .where(
          and(
            eq(replayRequests.tenantId, context.tenantId),
            eq(replayRequests.bookingId, bookingId),
          ),
        ),
      db
        .select({
          id: sessionEvents.id,
          eventType: sessionEvents.eventType,
          status: sessionEvents.status,
          createdAt: sessionEvents.createdAt,
          triggeredAt: sessionEvents.triggeredAt,
        })
        .from(sessionEvents)
        .where(
          and(
            eq(sessionEvents.tenantId, context.tenantId),
            eq(sessionEvents.bookingId, bookingId),
          ),
        ),
    ])

  const playSession = playSessionRow[0]
    ? {
        id: playSessionRow[0].id,
        status: playSessionRow[0].status,
        correlationId: playSessionRow[0].correlationId,
        createdAt: playSessionRow[0].createdAt.toISOString(),
        preparedAt: playSessionRow[0].preparedAt?.toISOString() ?? null,
        startedAt: playSessionRow[0].startedAt?.toISOString() ?? null,
        endedAt: playSessionRow[0].endedAt?.toISOString() ?? null,
        completedAt: playSessionRow[0].completedAt?.toISOString() ?? null,
        resetAt: playSessionRow[0].resetAt?.toISOString() ?? null,
      }
    : null

  const correlationIds = [
    buildConfirmationCorrelationId(bookingId),
    ...(playSession ? [playSession.correlationId] : []),
    ...replayRequestRows.map((row) => row.correlationId),
  ]

  const aggregateIds = [
    bookingId,
    ...paymentRows.map((row) => row.id),
    ...(playSession ? [playSession.id] : []),
    ...replayRequestRows.map((row) => row.id),
  ]

  const entityIds = [
    ...aggregateIds,
    ...replayRequestRows.map((row) => row.mediaAssetId),
    ...replayRequestRows
      .map((row) => row.deviceCommandId)
      .filter((value): value is string => Boolean(value)),
  ]

  const [outboxRows, auditRows] = await Promise.all([
    db
      .select({
        id: outboxEvents.id,
        eventType: outboxEvents.eventType,
        status: outboxEvents.status,
        aggregateType: outboxEvents.aggregateType,
        aggregateId: outboxEvents.aggregateId,
        correlationId: outboxEvents.correlationId,
        createdAt: outboxEvents.createdAt,
        processedAt: outboxEvents.processedAt,
        lastError: outboxEvents.lastError,
      })
      .from(outboxEvents)
      .where(
        and(
          eq(outboxEvents.tenantId, context.tenantId),
          or(
            inArray(outboxEvents.aggregateId, aggregateIds),
            inArray(outboxEvents.correlationId, correlationIds),
          ),
        ),
      ),
    db
      .select({
        id: auditLogs.id,
        action: auditLogs.action,
        targetType: auditLogs.targetType,
        targetId: auditLogs.targetId,
        correlationId: auditLogs.correlationId,
        createdAt: auditLogs.createdAt,
        metadata: auditLogs.metadata,
      })
      .from(auditLogs)
      .where(
        and(
          eq(auditLogs.tenantId, context.tenantId),
          or(
            inArray(auditLogs.correlationId, correlationIds),
            inArray(auditLogs.targetId, entityIds),
          ),
        ),
      ),
  ])

  const deviceCommandIds = replayRequestRows
    .map((row) => row.deviceCommandId)
    .filter((value): value is string => Boolean(value))

  const mediaAssetIds = [
    ...new Set(replayRequestRows.map((row) => row.mediaAssetId)),
  ]

  const [deviceCommandRows, mediaAssetRows] = await Promise.all([
    deviceCommandIds.length > 0 || correlationIds.length > 0
      ? db
          .select({
            id: deviceCommands.id,
            kind: deviceCommands.kind,
            status: deviceCommands.status,
            correlationId: deviceCommands.correlationId,
            createdAt: deviceCommands.createdAt,
            deliveredAt: deviceCommands.deliveredAt,
            acknowledgedAt: deviceCommands.acknowledgedAt,
            failedAt: deviceCommands.failedAt,
            lastError: deviceCommands.lastError,
          })
          .from(deviceCommands)
          .where(
            and(
              eq(deviceCommands.tenantId, context.tenantId),
              or(
                deviceCommandIds.length > 0
                  ? inArray(deviceCommands.id, deviceCommandIds)
                  : undefined,
                inArray(deviceCommands.correlationId, correlationIds),
              ),
            ),
          )
      : Promise.resolve([]),
    mediaAssetIds.length > 0 || playSession
      ? db
          .select({
            id: mediaAssets.id,
            status: mediaAssets.status,
            createdAt: mediaAssets.createdAt,
            uploadedAt: mediaAssets.uploadedAt,
            readyAt: mediaAssets.readyAt,
          })
          .from(mediaAssets)
          .where(
            and(
              eq(mediaAssets.tenantId, context.tenantId),
              or(
                mediaAssetIds.length > 0
                  ? inArray(mediaAssets.id, mediaAssetIds)
                  : undefined,
                playSession
                  ? eq(mediaAssets.playSessionId, playSession.id)
                  : undefined,
              ),
            ),
          )
      : Promise.resolve([]),
  ])

  return {
    header,
    payments: paymentRows.map((row) => ({
      id: row.id,
      status: row.status,
      providerReference: row.providerReference,
      createdAt: row.createdAt.toISOString(),
      paidAt: row.paidAt?.toISOString() ?? null,
    })),
    playSession,
    outboxEvents: outboxRows.map((row) => ({
      id: row.id,
      eventType: row.eventType,
      status: row.status,
      aggregateType: row.aggregateType,
      aggregateId: row.aggregateId,
      correlationId: row.correlationId,
      createdAt: row.createdAt.toISOString(),
      processedAt: row.processedAt?.toISOString() ?? null,
      lastError: row.lastError,
    })),
    auditLogs: auditRows.map((row) => ({
      id: row.id,
      action: row.action,
      targetType: row.targetType,
      targetId: row.targetId,
      correlationId: row.correlationId,
      createdAt: row.createdAt.toISOString(),
      metadata: row.metadata ?? null,
    })),
    replayRequests: replayRequestRows.map((row) => ({
      id: row.id,
      status: row.status,
      correlationId: row.correlationId,
      failureReason: row.failureReason,
      deviceCommandId: row.deviceCommandId,
      mediaAssetId: row.mediaAssetId,
      createdAt: row.createdAt.toISOString(),
      dispatchedAt: row.dispatchedAt?.toISOString() ?? null,
      edgeAcknowledgedAt: row.edgeAcknowledgedAt?.toISOString() ?? null,
      capturingAt: row.capturingAt?.toISOString() ?? null,
      extractingAt: row.extractingAt?.toISOString() ?? null,
      uploadingAt: row.uploadingAt?.toISOString() ?? null,
      verifyingAt: row.verifyingAt?.toISOString() ?? null,
      readyAt: row.readyAt?.toISOString() ?? null,
      failedAt: row.failedAt?.toISOString() ?? null,
      expiredAt: row.expiredAt?.toISOString() ?? null,
    })),
    deviceCommands: deviceCommandRows.map((row) => ({
      id: row.id,
      kind: row.kind,
      status: row.status,
      correlationId: row.correlationId,
      createdAt: row.createdAt.toISOString(),
      deliveredAt: row.deliveredAt?.toISOString() ?? null,
      acknowledgedAt: row.acknowledgedAt?.toISOString() ?? null,
      failedAt: row.failedAt?.toISOString() ?? null,
      lastError: row.lastError,
    })),
    mediaAssets: mediaAssetRows.map((row) => ({
      id: row.id,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
      uploadedAt: row.uploadedAt?.toISOString() ?? null,
      readyAt: row.readyAt?.toISOString() ?? null,
    })),
    sessionEvents: sessionEventRows.map((row) => ({
      id: row.id,
      eventType: row.eventType,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
      triggeredAt: row.triggeredAt?.toISOString() ?? null,
    })),
  }
}
