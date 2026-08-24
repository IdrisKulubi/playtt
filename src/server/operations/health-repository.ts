import { and, eq, inArray, lt, ne, notInArray, sql } from "drizzle-orm"

import db from "@/db/drizzle"
import {
  accessCredentials,
  accessPoints,
  deviceCommands,
  devices,
  playSessions,
  replayRequests,
} from "@/db/schema"
import { deriveDeviceHealth } from "@/server/devices/health-policy"
import { getLatestDeviceHeartbeat } from "@/server/devices/heartbeats"
import { countTenantDeadLetters } from "@/server/operator/durable-work-repository"
import { listVenues } from "@/server/operator/repository"
import { countWebhookInboxByStatus } from "@/server/payments/webhook-inbox-repository"
import {
  FAILED_REPLAY_STATUSES,
  IN_FLIGHT_REPLAY_STATUSES,
  STUCK_SESSION_GRACE_MS,
  TERMINAL_PLAY_SESSION_STATUSES,
  type WorkerHealthInput,
} from "@/server/operations/health-status"
import type { TenantContext } from "@/server/tenancy/types"
import { countOutboxEventsByStatus } from "@/server/workers/outbox-repository"

export interface RawVenueDeviceRow {
  id: string
  locationId: string
  type: string
  health: "online" | "offline" | "unknown"
}

export interface RawVenueEdgeMetrics {
  locationId: string
  health: "online" | "offline" | "unknown"
  replayQueueDepth: number
  maxConcurrentReplays: number
}

export interface RawVenueHealthRow {
  venueId: string
  venueName: string
  deviceHealths: Array<"online" | "offline" | "unknown">
  edge: RawVenueEdgeMetrics | null
  stuckSessionCount: number
  replayFailedCount: number
  replayInFlightCount: number
  failedCommandCount: number
  accessPointCount: number
  failedAccessCredentialCount: number
  pendingAccessCredentialCount: number
}

export async function fetchTenantWorkerHealth(
  context: TenantContext,
): Promise<WorkerHealthInput> {
  const [inboxBacklog, outboxBacklog, deadLetters] = await Promise.all([
    countWebhookInboxByStatus(context.tenantId),
    countOutboxEventsByStatus(context.tenantId),
    countTenantDeadLetters(context),
  ])

  return {
    inboxBacklog,
    outboxBacklog,
    deadLetterInbox: deadLetters.inbox,
    deadLetterOutbox: deadLetters.outbox,
  }
}

export async function fetchVenueHealthRows(
  context: TenantContext,
  locationId?: string,
): Promise<RawVenueHealthRow[]> {
  const venues = await listVenues(context)
  const scopedVenues = locationId
    ? venues.filter((venue) => venue.id === locationId)
    : venues

  if (scopedVenues.length === 0) {
    return []
  }

  const tenantId = context.tenantId
  const venueIds = scopedVenues.map((venue) => venue.id)
  const stuckCutoff = new Date(Date.now() - STUCK_SESSION_GRACE_MS)

  const [deviceRows, stuckSessionRows, replayRows, failedCommandRows, accessPointRows, accessCredentialRows] =
    await Promise.all([
    db
      .select({
        id: devices.id,
        locationId: devices.locationId,
        type: devices.type,
        lastHeartbeatAt: devices.lastHeartbeatAt,
      })
      .from(devices)
      .where(
        and(
          eq(devices.tenantId, tenantId),
          inArray(devices.locationId, venueIds),
          ne(devices.status, "revoked"),
        ),
      ),
    db
      .select({
        locationId: playSessions.locationId,
        count: sql<number>`count(*)::int`,
      })
      .from(playSessions)
      .where(
        and(
          eq(playSessions.tenantId, tenantId),
          inArray(playSessions.locationId, venueIds),
          notInArray(playSessions.status, [...TERMINAL_PLAY_SESSION_STATUSES]),
          lt(playSessions.scheduledEndAt, stuckCutoff),
        ),
      )
      .groupBy(playSessions.locationId),
    db
      .select({
        locationId: replayRequests.locationId,
        status: replayRequests.status,
      })
      .from(replayRequests)
      .where(
        and(
          eq(replayRequests.tenantId, tenantId),
          inArray(replayRequests.locationId, venueIds),
        ),
      ),
    db
      .select({
        locationId: devices.locationId,
        count: sql<number>`count(*)::int`,
      })
      .from(deviceCommands)
      .innerJoin(devices, eq(deviceCommands.deviceId, devices.id))
      .where(
        and(
          eq(deviceCommands.tenantId, tenantId),
          eq(devices.tenantId, tenantId),
          inArray(devices.locationId, venueIds),
          eq(deviceCommands.status, "failed"),
        ),
      )
      .groupBy(devices.locationId),
    db
      .select({
        locationId: accessPoints.locationId,
        count: sql<number>`count(*)::int`,
      })
      .from(accessPoints)
      .where(
        and(
          eq(accessPoints.tenantId, tenantId),
          inArray(accessPoints.locationId, venueIds),
        ),
      )
      .groupBy(accessPoints.locationId),
    db
      .select({
        locationId: accessCredentials.locationId,
        status: accessCredentials.status,
        count: sql<number>`count(*)::int`,
      })
      .from(accessCredentials)
      .where(
        and(
          eq(accessCredentials.tenantId, tenantId),
          inArray(accessCredentials.locationId, venueIds),
        ),
      )
      .groupBy(accessCredentials.locationId, accessCredentials.status),
  ])

  const mappedDevices: RawVenueDeviceRow[] = deviceRows.map((row) => ({
    id: row.id,
    locationId: row.locationId,
    type: row.type,
    health: deriveDeviceHealth(row.lastHeartbeatAt),
  }))

  const edgeDevices = mappedDevices.filter((device) => device.type === "venue_edge")
  const edgeMetricsByVenue = new Map<string, RawVenueEdgeMetrics>()

  await Promise.all(
    edgeDevices.map(async (edgeDevice) => {
      const heartbeat = await getLatestDeviceHeartbeat(tenantId, edgeDevice.id)
      const metrics = heartbeat?.metrics ?? {}

      edgeMetricsByVenue.set(edgeDevice.locationId, {
        locationId: edgeDevice.locationId,
        health: edgeDevice.health,
        replayQueueDepth: Number(metrics.uploadQueueDepth ?? 0),
        maxConcurrentReplays: Number(metrics.maxConcurrentReplays ?? 0),
      })
    }),
  )

  const stuckSessionsByVenue = new Map(
    stuckSessionRows.map((row) => [row.locationId, row.count]),
  )

  const replayCountsByVenue = new Map<
    string,
    { failed: number; inFlight: number }
  >()

  for (const row of replayRows) {
    const current = replayCountsByVenue.get(row.locationId) ?? {
      failed: 0,
      inFlight: 0,
    }

    if ((FAILED_REPLAY_STATUSES as readonly string[]).includes(row.status)) {
      current.failed += 1
    }

    if ((IN_FLIGHT_REPLAY_STATUSES as readonly string[]).includes(row.status)) {
      current.inFlight += 1
    }

    replayCountsByVenue.set(row.locationId, current)
  }

  const failedCommandsByVenue = new Map(
    failedCommandRows.map((row) => [row.locationId, row.count]),
  )

  const accessPointsByVenue = new Map(
    accessPointRows.map((row) => [row.locationId, row.count]),
  )

  const accessCredentialsByVenue = new Map<
    string,
    { failed: number; pending: number }
  >()

  for (const row of accessCredentialRows) {
    const current = accessCredentialsByVenue.get(row.locationId) ?? {
      failed: 0,
      pending: 0,
    }

    if (row.status === "failed") {
      current.failed += row.count
    }

    if (row.status === "pending") {
      current.pending += row.count
    }

    accessCredentialsByVenue.set(row.locationId, current)
  }

  return scopedVenues.map((venue) => {
    const venueDevices = mappedDevices.filter(
      (device) => device.locationId === venue.id,
    )
    const replayCounts = replayCountsByVenue.get(venue.id) ?? {
      failed: 0,
      inFlight: 0,
    }
    const accessCredentials = accessCredentialsByVenue.get(venue.id) ?? {
      failed: 0,
      pending: 0,
    }

    return {
      venueId: venue.id,
      venueName: venue.name,
      deviceHealths: venueDevices.map((device) => device.health),
      edge: edgeMetricsByVenue.get(venue.id) ?? null,
      stuckSessionCount: stuckSessionsByVenue.get(venue.id) ?? 0,
      replayFailedCount: replayCounts.failed,
      replayInFlightCount: replayCounts.inFlight,
      failedCommandCount: failedCommandsByVenue.get(venue.id) ?? 0,
      accessPointCount: accessPointsByVenue.get(venue.id) ?? 0,
      failedAccessCredentialCount: accessCredentials.failed,
      pendingAccessCredentialCount: accessCredentials.pending,
    }
  })
}
