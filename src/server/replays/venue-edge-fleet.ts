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

export type VenueEdgeLifecycleStage =
  | "pair_device"
  | "add_nvr"
  | "review_cameras"
  | "map_tables"
  | "publish_config"
  | "complete_commissioning"

export interface VenueEdgeChecklistBlocker {
  code: string
  label: string
  detail: string
  stage: VenueEdgeLifecycleStage
}

export interface VenueEdgeTopologyState {
  topology: TopologyCounts
  observedAt: string | null
  revisionId: string | null
  revisionVersion: number | null
  checksum: string | null
}

export interface VenueEdgeConfigDiagnostic {
  code: string | null
  staleReason: "version_not_newer" | "installation_mismatch" | null
  localVersion: number | null
  receivedVersion: number | null
  localInstallationId: string | null
  receivedInstallationId: string | null
  remediation: string | null
}

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
  updateStatus: string
  pinnedVersion: string | null
  lastUpdateAt: string | null
  lastUpdateErrorCode: string | null
  activeUpdateAttemptId: string | null
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
  lifecycleStage: VenueEdgeLifecycleStage
  readiness: "ready" | "action_required"
  nextAction: { label: string; detail: string; href: string }
  checklistBlockers: VenueEdgeChecklistBlocker[]
  reportedTopology: VenueEdgeTopologyState
  desiredTopology: VenueEdgeTopologyState
  appliedTopology: VenueEdgeTopologyState
  topologyDrift: {
    hasDrift: boolean
    summary: string
  }
  configDiagnostic: VenueEdgeConfigDiagnostic | null
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
    diagnostic: VenueEdgeConfigDiagnostic | null
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
  recentConfigApplications: Array<{
    id: string
    revisionVersion: number
    status: string
    attemptedAt: string
    appliedAt: string | null
    errorCode: string | null
  }>
}

function readSafeString(details: Record<string, unknown> | null, keys: string[]) {
  for (const key of keys) {
    const value = details?.[key]
    if (typeof value === "string" && value.trim()) return value.trim()
  }
  return null
}

function readSafeNumber(details: Record<string, unknown> | null, keys: string[]) {
  for (const key of keys) {
    const value = details?.[key]
    if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) {
      return value
    }
  }
  return null
}

function safeConfigDiagnostic(
  errorCode: string | null,
  errorDetails: Record<string, unknown> | null,
): VenueEdgeConfigDiagnostic | null {
  if (!errorCode) return null
  const reason = readSafeString(errorDetails, ["reason", "staleReason"])
  const staleReason =
    reason === "version_not_newer" || reason === "installation_mismatch"
      ? reason
      : null
  return {
    code: errorCode,
    staleReason,
    localVersion: readSafeNumber(errorDetails, ["localVersion", "appliedVersion"]),
    receivedVersion: readSafeNumber(errorDetails, ["receivedVersion", "revisionVersion"]),
    localInstallationId: readSafeString(errorDetails, ["localInstallationId"]),
    receivedInstallationId: readSafeString(errorDetails, ["receivedInstallationId"]),
    remediation:
      staleReason === "installation_mismatch"
        ? "This venue PC still has configuration from a previous pairing. Use Replace PC on this page, or stop VenueEdge and reset its local config cache, then publish again."
        : staleReason === "version_not_newer"
          ? "Publish a revision newer than the version already stored on the venue PC."
          : "Review the local VenueEdge logs, then retry configuration delivery.",
  }
}

function countPublishedTopology(snapshot: Record<string, unknown> | null): TopologyCounts {
  const recorders = Array.isArray(snapshot?.recorders) ? snapshot.recorders : []
  const sources = Array.isArray(snapshot?.sources) ? snapshot.sources : []
  return {
    nvrCount: recorders.length,
    cameraCount: sources.length,
    enabledCameraCount: sources.filter(
      (source) => source && typeof source === "object" && (source as { enabled?: unknown }).enabled === true,
    ).length,
  }
}

function deriveWorkflow(input: {
  installationId: string
  connectivity: VenueEdgeFleetConnectivity
  commissioned: boolean
  reported: VenueEdgeTopologyState
  desired: VenueEdgeTopologyState
  applied: VenueEdgeTopologyState
  routeCount: number
  sourceHealth: SourceHealthCounts
  reauthRequiredCount: number
  hostSleepRisk: boolean
  configStatus: string | null
  diagnostic: VenueEdgeConfigDiagnostic | null
}) {
  const blockers: VenueEdgeChecklistBlocker[] = []
  if (input.connectivity === "pending_setup" || input.connectivity === "waiting_for_install") {
    blockers.push({ code: "PAIR_DEVICE", label: "Pair the venue PC", detail: "Finish pairing before adding recorder details.", stage: "pair_device" })
  }
  if (input.reported.topology.nvrCount === 0) {
    blockers.push({ code: "ADD_NVR", label: "Add an NVR", detail: "Open the local setup wizard and connect the venue recorder.", stage: "add_nvr" })
  }
  if (input.reported.topology.enabledCameraCount === 0) {
    blockers.push({ code: "REVIEW_CAMERAS", label: "Review camera channels", detail: "Test and enable at least one real camera channel locally.", stage: "review_cameras" })
  }
  if (input.routeCount === 0) {
    blockers.push({ code: "MAP_TABLES", label: "Map cameras to tables", detail: "Every replay table needs a primary camera route.", stage: "map_tables" })
  }
  const configReady =
    input.desired.revisionVersion !== null &&
    input.desired.revisionVersion === input.applied.revisionVersion &&
    input.configStatus === "applied"
  if (!configReady) {
    blockers.push({
      code: input.diagnostic?.code ?? "PUBLISH_CONFIG",
      label: input.diagnostic?.staleReason ? "Recover configuration delivery" : "Publish and apply configuration",
      detail: input.diagnostic?.remediation ?? "Publish the reviewed topology and wait for the venue PC to apply it.",
      stage: "publish_config",
    })
  }
  if (!input.commissioned) {
    blockers.push({ code: "COMPLETE_COMMISSIONING", label: "Complete commissioning", detail: "Finish the local checks after configuration is applied.", stage: "complete_commissioning" })
  }
  if (input.reauthRequiredCount > 0) {
    blockers.push({ code: "REENTER_CREDENTIALS", label: "Re-enter NVR credentials", detail: "Credentials are entered only in the local setup wizard.", stage: "add_nvr" })
  }
  if (input.hostSleepRisk) {
    blockers.push({ code: "HOST_SLEEP_RISK", label: "Disable sleep on the venue PC", detail: "Sleep can interrupt replay capture and commissioning checks.", stage: "complete_commissioning" })
  }

  const next = blockers[0]
  const lifecycleStage = next?.stage ?? "complete_commissioning"
  return {
    lifecycleStage,
    readiness: blockers.length === 0 ? ("ready" as const) : ("action_required" as const),
    checklistBlockers: blockers,
    nextAction: {
      label: next ? "Continue setup" : "View installation",
      detail: next?.label ?? "VenueEdge is ready for replay capture.",
      href: `/nvr/${input.installationId}#${lifecycleStage}`,
    },
    topologyDrift: {
      hasDrift:
        input.desired.revisionVersion !== input.applied.revisionVersion ||
        JSON.stringify(input.reported.topology) !== JSON.stringify(input.desired.topology),
      summary: configReady
        ? "Desired configuration is applied on the venue PC."
        : input.diagnostic?.remediation ?? "Local, desired, and applied topology are not yet aligned.",
    },
  }
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
      snapshot: venueEdgeConfigRevisions.snapshot,
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
      checksum: venueEdgeConfigRevisions.checksumSha256,
      snapshot: venueEdgeConfigRevisions.snapshot,
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
    checksum: application.checksum,
    snapshot: application.snapshot,
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
      errorDetails: venueEdgeConfigApplications.errorDetails,
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
    const lastAppliedRevision = await loadLastAppliedConfigRevision(
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

    const reportedTopology: VenueEdgeTopologyState = {
      topology,
      observedAt: commissioningSnapshot?.publishedAt ?? row.installation.updatedAt.toISOString(),
      revisionId: null,
      revisionVersion: null,
      checksum: null,
    }
    const desiredTopology: VenueEdgeTopologyState = {
      topology: countPublishedTopology(publishedRevision?.snapshot ?? null),
      observedAt: publishedRevision?.publishedAt?.toISOString() ?? null,
      revisionId: publishedRevision?.id ?? null,
      revisionVersion: publishedRevision?.version ?? null,
      checksum: publishedRevision?.checksumSha256 ?? null,
    }
    const appliedTopology: VenueEdgeTopologyState = {
      topology: countPublishedTopology(lastAppliedRevision?.snapshot ?? null),
      observedAt: lastAppliedRevision?.appliedAt ?? null,
      revisionId: lastAppliedRevision?.id ?? null,
      revisionVersion: lastAppliedRevision?.version ?? null,
      checksum: lastAppliedRevision?.checksum ?? null,
    }
    const routeCount = commissioningSnapshot?.resourceRoutes?.filter(
      (route) => route.enabled !== false,
    ).length ?? 0
    const configDiagnostic = safeConfigDiagnostic(
      configApplication?.errorCode ?? null,
      configApplication?.errorDetails ?? null,
    )
    const workflow = deriveWorkflow({
      installationId: row.installation.id,
      connectivity: deriveConnectivity({ deviceStatus: row.device.status, lastHeartbeatAt: row.device.lastHeartbeatAt }),
      commissioned: Boolean(row.installation.commissionedAt),
      reported: reportedTopology,
      desired: desiredTopology,
      applied: appliedTopology,
      routeCount,
      sourceHealth,
      reauthRequiredCount: secretRefs.filter((ref) => ref.status === "reauth_required").length,
      hostSleepRisk: sleepRisk.hostSleepRisk,
      configStatus: configApplication?.status ?? null,
      diagnostic: configDiagnostic,
    })

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
      updateStatus: row.installation.updateStatus,
      pinnedVersion: row.installation.pinnedVersion,
      lastUpdateAt: row.installation.lastUpdateAt?.toISOString() ?? null,
      lastUpdateErrorCode: row.installation.lastUpdateErrorCode,
      activeUpdateAttemptId: row.installation.activeUpdateAttemptId,
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
      ...workflow,
      reportedTopology,
      desiredTopology,
      appliedTopology,
      configDiagnostic,
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

  const recentApplications = await db
    .select({
      id: venueEdgeConfigApplications.id,
      revisionVersion: venueEdgeConfigRevisions.version,
      status: venueEdgeConfigApplications.status,
      attemptedAt: venueEdgeConfigApplications.attemptedAt,
      appliedAt: venueEdgeConfigApplications.appliedAt,
      errorCode: venueEdgeConfigApplications.errorCode,
    })
    .from(venueEdgeConfigApplications)
    .innerJoin(
      venueEdgeConfigRevisions,
      and(
        eq(venueEdgeConfigRevisions.tenantId, venueEdgeConfigApplications.tenantId),
        eq(venueEdgeConfigRevisions.id, venueEdgeConfigApplications.configRevisionId),
      ),
    )
    .where(
      and(
        eq(venueEdgeConfigApplications.tenantId, context.tenantId),
        eq(venueEdgeConfigApplications.locationId, row.installation.locationId),
        eq(venueEdgeConfigApplications.edgeDeviceId, row.installation.edgeDeviceId),
      ),
    )
    .orderBy(desc(venueEdgeConfigApplications.attemptedAt))
    .limit(12)

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
          diagnostic: safeConfigDiagnostic(
            configApplication.errorCode ?? null,
            configApplication.errorDetails ?? null,
          ),
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
    recentConfigApplications: recentApplications.map((application) => ({
      id: application.id,
      revisionVersion: application.revisionVersion,
      status: application.status,
      attemptedAt: application.attemptedAt.toISOString(),
      appliedAt: application.appliedAt?.toISOString() ?? null,
      errorCode: application.errorCode ?? null,
    })),
  }
}
