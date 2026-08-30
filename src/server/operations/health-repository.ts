import { and, eq, inArray, lt, ne, notInArray, sql } from "drizzle-orm"

import db from "@/db/drizzle"
import {
  accessCredentials,
  accessPoints,
  deviceCommands,
  devices,
  playSessions,
  replayRequests,
  venueEdgeInstallations,
  venueEdgeReleases,
} from "@/db/schema"
import { deriveDeviceHealth } from "@/server/devices/health-policy"
import { getLatestDeviceHeartbeat } from "@/server/devices/heartbeats"
import { countTenantDeadLetters } from "@/server/operator/durable-work-repository"
import { listVenues } from "@/server/operator/repository"
import { countWebhookInboxByStatus } from "@/server/payments/webhook-inbox-repository"
import {
  extractEdgeSourceHealthIssues,
  FAILED_REPLAY_STATUSES,
  IN_FLIGHT_REPLAY_STATUSES,
  STUCK_SESSION_GRACE_MS,
  TERMINAL_PLAY_SESSION_STATUSES,
  type EdgeSourceHealthEntry,
  type EdgeSourceHealthIssue,
  type WorkerHealthInput,
} from "@/server/operations/health-status"
import type { TenantContext } from "@/server/tenancy/types"
import { compareSemver } from "@/server/replays/edge-agent-version"
import { countOutboxEventsByStatus } from "@/server/workers/outbox-repository"

export interface RawVenueDeviceRow {
  id: string
  locationId: string
  type: string
  health: "online" | "offline" | "unknown"
}

export interface RawVenueEdgeMetrics {
  locationId: string
  installationId: string
  health: "online" | "offline" | "unknown"
  replayQueueDepth: number
  maxConcurrentReplays: number
  updateStatus?: string | null
  lastUpdateErrorCode?: string | null
  diskPressure?: boolean
  unsupportedVersion?: boolean
  unhealthyCameraCount?: number
  nvrOfflineCount?: number
  clockSkewCount?: number
  staleBufferCount?: number
  repeatedFailoverCount?: number
  sourceHealthIssues?: EdgeSourceHealthIssue[]
}

export interface RawVenueHealthRow {
  venueId: string
  venueName: string
  deviceHealths: Array<"online" | "offline" | "unknown">
  edge: RawVenueEdgeMetrics | null
  edgeInstallationId: string | null
  edgeSourceIssues: EdgeSourceHealthIssue[]
  stuckSessionCount: number
  replayFailedCount: number
  replayInFlightCount: number
  failedCommandCount: number
  accessPointCount: number
  failedAccessCredentialCount: number
  pendingAccessCredentialCount: number
}

function parseSourceHealthEntries(
  metrics: Record<string, unknown> | null | undefined,
): EdgeSourceHealthEntry[] {
  if (!Array.isArray(metrics?.sourceHealth)) {
    return []
  }

  return metrics.sourceHealth
    .filter(
      (entry): entry is Record<string, unknown> =>
        Boolean(entry) && typeof entry === "object" && !Array.isArray(entry),
    )
    .map((entry) => ({
      sourceId: typeof entry.sourceId === "string" ? entry.sourceId : null,
      recorderId:
        typeof entry.recorderId === "string" ? entry.recorderId : null,
      resourceId:
        typeof entry.resourceId === "string" ? entry.resourceId : null,
      status: typeof entry.status === "string" ? entry.status : null,
      reasonCode:
        typeof entry.reasonCode === "string" ? entry.reasonCode : null,
      details:
        entry.details && typeof entry.details === "object"
          ? (entry.details as Record<string, unknown>)
          : undefined,
    }))
}

function isUnsupportedAgentVersion(
  version: string | null | undefined,
  minSupportedVersion: string | null | undefined,
): boolean {
  if (!version || !minSupportedVersion) {
    return false
  }

  const comparison = compareSemver(version, minSupportedVersion)
  return comparison === null || comparison < 0
}

function releaseLookupKey(input: {
  platform: string
  architecture: string
  channel: string
}) {
  return `${input.platform}:${input.architecture}:${input.channel}`
}

async function loadMinimumSupportedVersions(
  tenantId: string,
): Promise<Map<string, string>> {
  const rows = await db
    .select({
      platform: venueEdgeReleases.platform,
      architecture: venueEdgeReleases.architecture,
      channel: venueEdgeReleases.channel,
      minSupportedVersion: venueEdgeReleases.minSupportedVersion,
      publishedAt: venueEdgeReleases.publishedAt,
    })
    .from(venueEdgeReleases)
    .where(
      and(
        eq(venueEdgeReleases.tenantId, tenantId),
        eq(venueEdgeReleases.status, "published"),
      ),
    )
    .orderBy(sql`${venueEdgeReleases.publishedAt} desc nulls last`)

  const minimums = new Map<string, string>()

  for (const row of rows) {
    const key = releaseLookupKey({
      platform: row.platform,
      architecture: row.architecture,
      channel: row.channel,
    })

    if (!minimums.has(key)) {
      minimums.set(key, row.minSupportedVersion)
    }
  }

  return minimums
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
  const edgeSourceIssuesByVenue = new Map<string, EdgeSourceHealthIssue[]>()
  const minimumSupportedVersions = await loadMinimumSupportedVersions(tenantId)

  await Promise.all(
    edgeDevices.map(async (edgeDevice) => {
      const heartbeat = await getLatestDeviceHeartbeat(tenantId, edgeDevice.id)
      const metrics = heartbeat?.metrics ?? {}
      const [installation] = await db
        .select({
          id: venueEdgeInstallations.id,
          platform: venueEdgeInstallations.platform,
          architecture: venueEdgeInstallations.architecture,
          updateChannel: venueEdgeInstallations.updateChannel,
          currentAgentVersion: venueEdgeInstallations.currentAgentVersion,
          updateStatus: venueEdgeInstallations.updateStatus,
          lastUpdateErrorCode: venueEdgeInstallations.lastUpdateErrorCode,
        })
        .from(venueEdgeInstallations)
        .where(
          and(
            eq(venueEdgeInstallations.tenantId, tenantId),
            eq(venueEdgeInstallations.edgeDeviceId, edgeDevice.id),
          ),
        )
        .limit(1)

      const sourceHealth = parseSourceHealthEntries(metrics)
      const sourceHealthIssues = installation
        ? extractEdgeSourceHealthIssues({
            installationId: installation.id,
            sourceHealth,
          })
        : []

      const minimumSupportedVersion = installation
        ? minimumSupportedVersions.get(
            releaseLookupKey({
              platform: installation.platform,
              architecture: installation.architecture,
              channel: installation.updateChannel,
            }),
          )
        : undefined

      const currentIssues = edgeSourceIssuesByVenue.get(edgeDevice.locationId) ?? []
      edgeSourceIssuesByVenue.set(edgeDevice.locationId, [
        ...currentIssues,
        ...sourceHealthIssues,
      ])

      edgeMetricsByVenue.set(edgeDevice.locationId, {
        locationId: edgeDevice.locationId,
        installationId: installation?.id ?? edgeDevice.id,
        health: edgeDevice.health,
        replayQueueDepth: Number(metrics.uploadQueueDepth ?? 0),
        maxConcurrentReplays: Number(metrics.maxConcurrentReplays ?? 0),
        updateStatus: installation?.updateStatus ?? null,
        lastUpdateErrorCode: installation?.lastUpdateErrorCode ?? null,
        diskPressure: Boolean(metrics.diskPressure),
        unsupportedVersion: isUnsupportedAgentVersion(
          heartbeat?.firmwareVersion ?? installation?.currentAgentVersion ?? null,
          minimumSupportedVersion,
        ),
        unhealthyCameraCount: sourceHealth.filter(
          (entry) => entry.status === "degraded" || entry.status === "down",
        ).length,
        nvrOfflineCount: sourceHealth.filter(
          (entry) => entry.reasonCode === "nvr_unreachable",
        ).length,
        clockSkewCount: sourceHealthIssues.filter(
          (issue) => issue.code === "clock_skew",
        ).length,
        staleBufferCount: sourceHealthIssues.filter(
          (issue) => issue.code === "stale_buffer",
        ).length,
        repeatedFailoverCount: sourceHealthIssues.filter(
          (issue) => issue.code === "repeated_failover",
        ).length,
        sourceHealthIssues,
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
      edgeInstallationId: edgeMetricsByVenue.get(venue.id)?.installationId ?? null,
      edgeSourceIssues: edgeSourceIssuesByVenue.get(venue.id) ?? [],
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
