import { and, desc, eq } from "drizzle-orm"

import db from "@/db/drizzle"
import {
  deviceHeartbeats,
  devices,
  replayCaptureAttempts,
  venueEdgeConfigApplications,
  venueEdgeConfigRevisions,
  venueEdgeInstallations,
  venueEdgeSecretRefs,
} from "@/db/schema"
import { DeviceError } from "@/server/devices/errors"
import { deriveDeviceHealth } from "@/server/devices/health-policy"
import {
  countSourceHealthFromMetrics,
  countTopologyFromSnapshot,
  parseCommissioningSnapshot,
  readHostSleepRisk,
  type CommissioningSnapshot,
  type SourceHealthCounts,
  type TopologyCounts,
} from "@/server/replays/venue-edge-topology"
import type { TenantContext } from "@/server/tenancy/types"

export type VenueEdgeFleetConnectivity =
  | "online"
  | "offline"
  | "unknown"
  | "revoked"
  | "pending_setup"
  | "waiting_for_install"

export interface VenueEdgeInstallationFleetView {
  id: string
  locationId: string
  edgeDeviceId: string
  installationUid: string
  displayName: string
  platform: string
  architecture: string
  currentAgentVersion: string
  desiredAgentVersion: string | null
  updateChannel: string
  installedAt: string
  lastConfigAppliedAt: string | null
  commissionedAt: string | null
  commissioningState: "commissioned" | "not_commissioned"
  deviceStatus: string
  connectivity: VenueEdgeFleetConnectivity
  lastHeartbeatAt: string | null
  topology: TopologyCounts
  sourceHealth: SourceHealthCounts
  hasManualOverride: boolean
  hostSleepRisk: boolean
  hostSleepRiskReason: string | null
  diskPressure: boolean
  replayQueueDepth: number
  publishedConfigVersion: number | null
  configApplicationStatus: string | null
  reauthRequiredCount: number
}

export interface VenueEdgeInstallationDetailView
  extends VenueEdgeInstallationFleetView {
  commissioningSnapshot: CommissioningSnapshot | null
  publishedConfigRevision: {
    id: string
    version: number
    checksum: string
    publishedAt: string
  } | null
  lastAppliedConfigRevision: {
    id: string
    version: number
    appliedAt: string
  } | null
  configApplication: {
    status: string
    attemptedAt: string
    appliedAt: string | null
    errorCode: string | null
  } | null
  secretRefs: Array<{
    recorderId: string
    localKey: string
    username: string | null
    status: string
  }>
  recentCaptureAttempts: Array<{
    id: string
    replayRequestId: string
    cameraSourceId: string
    captureMode: string
    status: string
    createdAt: string
  }>
}

function deriveConnectivity(input: {
  deviceStatus: string | null
  lastHeartbeatAt: Date | null
}): VenueEdgeFleetConnectivity {
  if (input.deviceStatus === "revoked") {
    return "revoked"
  }

  if (input.deviceStatus === "pending") {
    return "pending_setup"
  }

  const health = deriveDeviceHealth(input.lastHeartbeatAt)
  if (health === "online") {
    return "online"
  }

  if (health === "offline") {
    return "offline"
  }

  return "unknown"
}

async function loadLatestHeartbeatMetrics(
  tenantId: string,
  deviceId: string,
): Promise<Record<string, unknown> | null> {
  const [heartbeat] = await db
    .select({ metrics: deviceHeartbeats.metrics })
    .from(deviceHeartbeats)
    .where(
      and(
        eq(deviceHeartbeats.tenantId, tenantId),
        eq(deviceHeartbeats.deviceId, deviceId),
      ),
    )
    .orderBy(desc(deviceHeartbeats.observedAt))
    .limit(1)

  if (!heartbeat?.metrics || typeof heartbeat.metrics !== "object") {
    return null
  }

  return heartbeat.metrics as Record<string, unknown>
}

function hasManualOverride(snapshot: CommissioningSnapshot | null): boolean {
  return (snapshot?.resourcePolicies ?? []).some(
    (policy) =>
      policy.selectionMode === "manual" &&
      typeof policy.manualSourceId === "string" &&
      policy.manualSourceId.length > 0,
  )
}

function readDiskPressure(metrics: Record<string, unknown> | null): boolean {
  const diskUsageBytes =
    typeof metrics?.diskUsageBytes === "number" ? metrics.diskUsageBytes : 0
  const reservedFreeDiskBytes =
    typeof metrics?.reservedFreeDiskBytes === "number"
      ? metrics.reservedFreeDiskBytes
      : 0
  return reservedFreeDiskBytes > 0 && diskUsageBytes > reservedFreeDiskBytes * 0.85
}

function readReplayQueueDepth(metrics: Record<string, unknown> | null): number {
  if (typeof metrics?.uploadQueueDepth === "number") {
    return metrics.uploadQueueDepth
  }

  if (typeof metrics?.replayQueueDepth === "number") {
    return metrics.replayQueueDepth
  }

  return 0
}

async function loadPublishedConfigSummary(
  tenantId: string,
  locationId: string,
) {
  const [revision] = await db
    .select({
      id: venueEdgeConfigRevisions.id,
      version: venueEdgeConfigRevisions.version,
      checksumSha256: venueEdgeConfigRevisions.checksumSha256,
      publishedAt: venueEdgeConfigRevisions.publishedAt,
    })
    .from(venueEdgeConfigRevisions)
    .where(
      and(
        eq(venueEdgeConfigRevisions.tenantId, tenantId),
        eq(venueEdgeConfigRevisions.locationId, locationId),
        eq(venueEdgeConfigRevisions.status, "published"),
      ),
    )
    .orderBy(desc(venueEdgeConfigRevisions.version))
    .limit(1)

  return revision
}

async function loadLastAppliedConfigRevision(
  tenantId: string,
  locationId: string,
  edgeDeviceId: string,
) {
  const [application] = await db
    .select({
      revisionId: venueEdgeConfigApplications.configRevisionId,
      appliedAt: venueEdgeConfigApplications.appliedAt,
      version: venueEdgeConfigRevisions.version,
    })
    .from(venueEdgeConfigApplications)
    .innerJoin(
      venueEdgeConfigRevisions,
      and(
        eq(
          venueEdgeConfigRevisions.tenantId,
          venueEdgeConfigApplications.tenantId,
        ),
        eq(
          venueEdgeConfigRevisions.id,
          venueEdgeConfigApplications.configRevisionId,
        ),
      ),
    )
    .where(
      and(
        eq(venueEdgeConfigApplications.tenantId, tenantId),
        eq(venueEdgeConfigApplications.locationId, locationId),
        eq(venueEdgeConfigApplications.edgeDeviceId, edgeDeviceId),
        eq(venueEdgeConfigApplications.status, "applied"),
      ),
    )
    .orderBy(desc(venueEdgeConfigApplications.appliedAt))
    .limit(1)

  if (!application?.appliedAt) {
    return null
  }

  return {
    id: application.revisionId,
    version: application.version,
    appliedAt: application.appliedAt.toISOString(),
  }
}

async function loadLatestConfigApplication(
  tenantId: string,
  locationId: string,
  edgeDeviceId: string,
) {
  const [application] = await db
    .select({
      status: venueEdgeConfigApplications.status,
      attemptedAt: venueEdgeConfigApplications.attemptedAt,
      appliedAt: venueEdgeConfigApplications.appliedAt,
      errorCode: venueEdgeConfigApplications.errorCode,
    })
    .from(venueEdgeConfigApplications)
    .where(
      and(
        eq(venueEdgeConfigApplications.tenantId, tenantId),
        eq(venueEdgeConfigApplications.locationId, locationId),
        eq(venueEdgeConfigApplications.edgeDeviceId, edgeDeviceId),
      ),
    )
    .orderBy(desc(venueEdgeConfigApplications.attemptedAt))
    .limit(1)

  return application
}

export async function listVenueEdgeInstallations(
  context: TenantContext,
  locationId: string,
  filters?: {
    health?: string
    commissioning?: string
    version?: string
  },
): Promise<VenueEdgeInstallationFleetView[]> {
  const rows = await db
    .select({
      installation: venueEdgeInstallations,
      device: devices,
    })
    .from(venueEdgeInstallations)
    .innerJoin(
      devices,
      and(
        eq(devices.tenantId, venueEdgeInstallations.tenantId),
        eq(devices.locationId, venueEdgeInstallations.locationId),
        eq(devices.id, venueEdgeInstallations.edgeDeviceId),
      ),
    )
    .where(
      and(
        eq(venueEdgeInstallations.tenantId, context.tenantId),
        eq(venueEdgeInstallations.locationId, locationId),
      ),
    )
    .orderBy(desc(venueEdgeInstallations.updatedAt))

  const publishedRevision = await loadPublishedConfigSummary(
    context.tenantId,
    locationId,
  )

  const installations: VenueEdgeInstallationFleetView[] = []

  for (const row of rows) {
    const metrics = await loadLatestHeartbeatMetrics(
      context.tenantId,
      row.installation.edgeDeviceId,
    )
    const commissioningSnapshot = parseCommissioningSnapshot(
      row.installation.commissioningSnapshotJson,
    )
    const topology =
      publishedRevision
        ? countTopologyFromSnapshot(commissioningSnapshot)
        : countTopologyFromSnapshot(commissioningSnapshot)
    const sourceHealth = countSourceHealthFromMetrics(metrics)
    const sleepRisk = readHostSleepRisk(metrics)
    const configApplication = await loadLatestConfigApplication(
      context.tenantId,
      locationId,
      row.installation.edgeDeviceId,
    )

    const secretRefs = await db
      .select({ status: venueEdgeSecretRefs.status })
      .from(venueEdgeSecretRefs)
      .where(
        and(
          eq(venueEdgeSecretRefs.tenantId, context.tenantId),
          eq(venueEdgeSecretRefs.locationId, locationId),
          eq(venueEdgeSecretRefs.edgeDeviceId, row.installation.edgeDeviceId),
        ),
      )

    const view: VenueEdgeInstallationFleetView = {
      id: row.installation.id,
      locationId: row.installation.locationId,
      edgeDeviceId: row.installation.edgeDeviceId,
      installationUid: row.installation.installationUid,
      displayName: row.installation.displayName,
      platform: row.installation.platform,
      architecture: row.installation.architecture,
      currentAgentVersion: row.installation.currentAgentVersion,
      desiredAgentVersion: row.installation.desiredAgentVersion,
      updateChannel: row.installation.updateChannel,
      installedAt: row.installation.installedAt.toISOString(),
      lastConfigAppliedAt:
        row.installation.lastConfigAppliedAt?.toISOString() ?? null,
      commissionedAt: row.installation.commissionedAt?.toISOString() ?? null,
      commissioningState: row.installation.commissionedAt
        ? "commissioned"
        : "not_commissioned",
      deviceStatus: row.device.status,
      connectivity: deriveConnectivity({
        deviceStatus: row.device.status,
        lastHeartbeatAt: row.device.lastHeartbeatAt,
      }),
      lastHeartbeatAt: row.device.lastHeartbeatAt?.toISOString() ?? null,
      topology,
      sourceHealth,
      hasManualOverride: hasManualOverride(commissioningSnapshot),
      hostSleepRisk: sleepRisk.hostSleepRisk,
      hostSleepRiskReason: sleepRisk.hostSleepRiskReason,
      diskPressure: readDiskPressure(metrics),
      replayQueueDepth: readReplayQueueDepth(metrics),
      publishedConfigVersion: publishedRevision?.version ?? null,
      configApplicationStatus: configApplication?.status ?? null,
      reauthRequiredCount: secretRefs.filter(
        (ref) => ref.status === "reauth_required",
      ).length,
    }

    installations.push(view)
  }

  return installations.filter((installation) => {
    if (filters?.health && installation.connectivity !== filters.health) {
      return false
    }

    if (
      filters?.commissioning &&
      installation.commissioningState !== filters.commissioning
    ) {
      return false
    }

    if (
      filters?.version &&
      installation.currentAgentVersion !== filters.version
    ) {
      return false
    }

    return true
  })
}

export async function getVenueEdgeInstallationDetail(
  context: TenantContext,
  installationId: string,
): Promise<VenueEdgeInstallationDetailView> {
  const [row] = await db
    .select({
      installation: venueEdgeInstallations,
      device: devices,
    })
    .from(venueEdgeInstallations)
    .innerJoin(
      devices,
      and(
        eq(devices.tenantId, venueEdgeInstallations.tenantId),
        eq(devices.locationId, venueEdgeInstallations.locationId),
        eq(devices.id, venueEdgeInstallations.edgeDeviceId),
      ),
    )
    .where(
      and(
        eq(venueEdgeInstallations.tenantId, context.tenantId),
        eq(venueEdgeInstallations.id, installationId),
      ),
    )
    .limit(1)

  if (!row) {
    throw new DeviceError(
      "VALIDATION_ERROR",
      "VenueEdge installation was not found.",
      404,
    )
  }

  const fleet = await listVenueEdgeInstallations(
    context,
    row.installation.locationId,
  )
  const summary = fleet.find((entry) => entry.id === installationId)
  if (!summary) {
    throw new DeviceError(
      "VALIDATION_ERROR",
      "VenueEdge installation was not found.",
      404,
    )
  }

  const commissioningSnapshot = parseCommissioningSnapshot(
    row.installation.commissioningSnapshotJson,
  )

  const publishedRevision = await loadPublishedConfigSummary(
    context.tenantId,
    row.installation.locationId,
  )

  const configApplication = await loadLatestConfigApplication(
    context.tenantId,
    row.installation.locationId,
    row.installation.edgeDeviceId,
  )

  const lastAppliedRevision = await loadLastAppliedConfigRevision(
    context.tenantId,
    row.installation.locationId,
    row.installation.edgeDeviceId,
  )

  const secretRefs = await db
    .select({
      recorderId: venueEdgeSecretRefs.recorderId,
      localKey: venueEdgeSecretRefs.localKey,
      username: venueEdgeSecretRefs.username,
      status: venueEdgeSecretRefs.status,
    })
    .from(venueEdgeSecretRefs)
    .where(
      and(
        eq(venueEdgeSecretRefs.tenantId, context.tenantId),
        eq(venueEdgeSecretRefs.locationId, row.installation.locationId),
        eq(venueEdgeSecretRefs.edgeDeviceId, row.installation.edgeDeviceId),
      ),
    )

  const captureAttempts = await db
    .select({
      id: replayCaptureAttempts.id,
      replayRequestId: replayCaptureAttempts.replayRequestId,
      cameraSourceId: replayCaptureAttempts.cameraSourceId,
      captureMode: replayCaptureAttempts.captureMode,
      status: replayCaptureAttempts.status,
      createdAt: replayCaptureAttempts.createdAt,
    })
    .from(replayCaptureAttempts)
    .where(
      and(
        eq(replayCaptureAttempts.tenantId, context.tenantId),
        eq(replayCaptureAttempts.locationId, row.installation.locationId),
      ),
    )
    .orderBy(desc(replayCaptureAttempts.createdAt))
    .limit(20)

  return {
    ...summary,
    commissioningSnapshot,
    publishedConfigRevision: publishedRevision?.publishedAt
      ? {
          id: publishedRevision.id,
          version: publishedRevision.version,
          checksum: publishedRevision.checksumSha256,
          publishedAt: publishedRevision.publishedAt.toISOString(),
        }
      : null,
    configApplication: configApplication
      ? {
          status: configApplication.status,
          attemptedAt: configApplication.attemptedAt.toISOString(),
          appliedAt: configApplication.appliedAt?.toISOString() ?? null,
          errorCode: configApplication.errorCode ?? null,
        }
      : null,
    lastAppliedConfigRevision: lastAppliedRevision,
    secretRefs,
    recentCaptureAttempts: captureAttempts.map((attempt) => ({
      id: attempt.id,
      replayRequestId: attempt.replayRequestId,
      cameraSourceId: attempt.cameraSourceId,
      captureMode: attempt.captureMode,
      status: attempt.status,
      createdAt: attempt.createdAt.toISOString(),
    })),
  }
}
