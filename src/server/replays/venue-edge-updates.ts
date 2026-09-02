import { randomUUID } from "node:crypto"

import { and, eq } from "drizzle-orm"

import db from "@/db/drizzle"
import {
  venueEdgeInstallations,
  venueEdgeReleases,
  venueEdgeUpdateAttempts,
} from "@/db/schema"
import { DeviceError } from "@/server/devices/errors"
import { VENUE_EDGE_AUDIT_ACTIONS } from "@/server/replays/venue-edge-audit-actions"
import {
  buildSignedManifestForInstallation,
  listPublishedVenueEdgeReleasesForChannel,
  revokeVenueEdgeRelease,
  type VenueEdgeReleaseRecord,
} from "@/server/replays/venue-edge-releases"
import {
  pickReleaseForInstallation,
  resolveEffectiveUpdateChannel,
  shouldOfferUpdate,
} from "@/server/replays/venue-edge-update-policy"
import {
  readUpdateSigningPrivateKey,
  type SignedVenueEdgeUpdateManifest,
  type VenueEdgeUpdateAttemptStatus,
} from "@/server/replays/venue-edge-update-manifest"
import { writeAuditLog } from "@/server/tenancy/audit-log-write"
import { resolveTenantContextForDevice } from "@/server/tenancy/context-factory"

export interface VenueEdgeUpdateManifestResponse {
  manifest: SignedVenueEdgeUpdateManifest | null
  desiredVersion: string | null
  currentVersion: string
  updateStatus: string
  attemptId: string | null
}

async function getInstallationForDevice(input: {
  tenantId: string
  deviceId: string
}) {
  const [installation] = await db
    .select()
    .from(venueEdgeInstallations)
    .where(
      and(
        eq(venueEdgeInstallations.tenantId, input.tenantId),
        eq(venueEdgeInstallations.edgeDeviceId, input.deviceId),
      ),
    )
    .limit(1)

  if (!installation) {
    throw new DeviceError(
      "VALIDATION_ERROR",
      "VenueEdge installation was not found for this device.",
      404,
    )
  }

  return installation
}

function mapInstallationUpdateState(
  installation: typeof venueEdgeInstallations.$inferSelect,
) {
  return {
    id: installation.id,
    locationId: installation.locationId,
    currentAgentVersion: installation.currentAgentVersion,
    desiredAgentVersion: installation.desiredAgentVersion,
    updateChannel: installation.updateChannel,
    rolloutCohortTag: installation.updateChannel,
    pinnedVersion: installation.pinnedVersion,
    platform: installation.platform,
    architecture: installation.architecture,
  }
}

async function findReleaseForInstallation(
  installation: typeof venueEdgeInstallations.$inferSelect,
): Promise<VenueEdgeReleaseRecord | null> {
  const channel = resolveEffectiveUpdateChannel(mapInstallationUpdateState(installation))

  const releases = await listPublishedVenueEdgeReleasesForChannel({
    tenantId: installation.tenantId,
    channel: channel === "pinned" ? installation.updateChannel : channel,
    platform: installation.platform,
    architecture: installation.architecture,
  })

  return pickReleaseForInstallation(
    mapInstallationUpdateState(installation),
    releases,
  )
}

export async function getVenueEdgeUpdateManifestForDevice(input: {
  tenantId: string
  deviceId: string
  correlationId: string
}): Promise<VenueEdgeUpdateManifestResponse> {
  const installation = await getInstallationForDevice(input)
  const release = await findReleaseForInstallation(installation)

  if (!release || !shouldOfferUpdate({ installation: mapInstallationUpdateState(installation), release })) {
    return {
      manifest: null,
      desiredVersion: release?.version ?? installation.desiredAgentVersion,
      currentVersion: installation.currentAgentVersion,
      updateStatus: installation.updateStatus,
      attemptId: installation.activeUpdateAttemptId,
    }
  }

  const privateKey = readUpdateSigningPrivateKey()
  if (!privateKey) {
    throw new DeviceError(
      "UPDATE_SIGNING_UNAVAILABLE",
      "Update signing is not configured.",
      503,
    )
  }

  if (
    installation.activeUpdateAttemptId &&
    (installation.updateStatus === "staged" ||
      installation.updateStatus === "applying")
  ) {
    const [existingAttempt] = await db
      .select()
      .from(venueEdgeUpdateAttempts)
      .where(
        and(
          eq(venueEdgeUpdateAttempts.tenantId, installation.tenantId),
          eq(venueEdgeUpdateAttempts.id, installation.activeUpdateAttemptId),
          eq(venueEdgeUpdateAttempts.installationId, installation.id),
        ),
      )
      .limit(1)

    if (
      existingAttempt &&
      existingAttempt.status === "started" &&
      existingAttempt.releaseId === release.id &&
      existingAttempt.targetVersion === release.version
    ) {
      const manifest = buildSignedManifestForInstallation({
        release,
        attemptId: existingAttempt.id,
        installationId: installation.id,
        privateKeyPem: privateKey,
      })

      return {
        manifest,
        desiredVersion: release.version,
        currentVersion: installation.currentAgentVersion,
        updateStatus: installation.updateStatus,
        attemptId: existingAttempt.id,
      }
    }
  }

  const attemptId = randomUUID()

  return db.transaction(async (tx) => {
    const [attempt] = await tx
      .insert(venueEdgeUpdateAttempts)
      .values({
        id: attemptId,
        tenantId: installation.tenantId,
        locationId: installation.locationId,
        installationId: installation.id,
        releaseId: release.id,
        edgeDeviceId: installation.edgeDeviceId,
        targetVersion: release.version,
        status: "started",
        correlationId: input.correlationId,
      })
      .returning()

    await tx
      .update(venueEdgeInstallations)
      .set({
        desiredAgentVersion: release.version,
        updateStatus: "staged",
        activeUpdateAttemptId: attempt.id,
        lastUpdateAt: new Date(),
        lastUpdateErrorCode: null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(venueEdgeInstallations.tenantId, installation.tenantId),
          eq(venueEdgeInstallations.id, installation.id),
        ),
      )

    const manifest = buildSignedManifestForInstallation({
      release,
      attemptId: attempt.id,
      installationId: installation.id,
      privateKeyPem: privateKey,
    })

    await writeAuditLog(
      resolveTenantContextForDevice({
        tenantId: installation.tenantId,
        deviceId: installation.edgeDeviceId,
        correlationId: input.correlationId,
      }),
      {
        action: VENUE_EDGE_AUDIT_ACTIONS.updateStarted,
        targetType: "venue_edge_installation",
        targetId: installation.id,
        metadata: {
          attemptId: attempt.id,
          targetVersion: release.version,
          releaseId: release.id,
          locationId: installation.locationId,
        },
      },
    )

    return {
      manifest,
      desiredVersion: release.version,
      currentVersion: installation.currentAgentVersion,
      updateStatus: "staged",
      attemptId: attempt.id,
    }
  })
}

export interface VenueEdgeUpdateResultInput {
  tenantId: string
  deviceId: string
  attemptId: string
  status: VenueEdgeUpdateAttemptStatus
  reasonCode?: string | null
  appliedVersion?: string | null
  correlationId: string
}

export async function recordVenueEdgeUpdateResult(
  input: VenueEdgeUpdateResultInput,
): Promise<{ accepted: true; updateStatus: string; currentVersion: string }> {
  const installation = await getInstallationForDevice(input)

  const [attempt] = await db
    .select()
    .from(venueEdgeUpdateAttempts)
    .where(
      and(
        eq(venueEdgeUpdateAttempts.tenantId, input.tenantId),
        eq(venueEdgeUpdateAttempts.id, input.attemptId),
        eq(venueEdgeUpdateAttempts.installationId, installation.id),
      ),
    )
    .limit(1)

  if (!attempt) {
    throw new DeviceError(
      "VALIDATION_ERROR",
      "Update attempt was not found.",
      404,
    )
  }

  if (attempt.status !== "started" && attempt.status === input.status) {
    return {
      accepted: true,
      updateStatus: installation.updateStatus,
      currentVersion: installation.currentAgentVersion,
    }
  }

  const auditContext = resolveTenantContextForDevice({
    tenantId: input.tenantId,
    deviceId: installation.edgeDeviceId,
    correlationId: input.correlationId,
  })

  const nextVersion =
    input.status === "succeeded" && input.appliedVersion
      ? input.appliedVersion
      : installation.currentAgentVersion

  const updateStatus =
    input.status === "succeeded"
      ? "succeeded"
      : input.status === "rolled_back"
        ? "rolled_back"
        : "failed"

  await db.transaction(async (tx) => {
    await tx
      .update(venueEdgeUpdateAttempts)
      .set({
        status: input.status,
        reasonCode: input.reasonCode ?? null,
        finishedAt: new Date(),
      })
      .where(
        and(
          eq(venueEdgeUpdateAttempts.tenantId, input.tenantId),
          eq(venueEdgeUpdateAttempts.id, input.attemptId),
        ),
      )

    await tx
      .update(venueEdgeInstallations)
      .set({
        currentAgentVersion: nextVersion,
        updateStatus,
        activeUpdateAttemptId: null,
        lastUpdateAt: new Date(),
        lastUpdateErrorCode:
          input.status === "failed" || input.status === "rolled_back"
            ? input.reasonCode ?? input.status
            : null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(venueEdgeInstallations.tenantId, installation.tenantId),
          eq(venueEdgeInstallations.id, installation.id),
        ),
      )
  })

  const auditAction =
    input.status === "succeeded"
      ? VENUE_EDGE_AUDIT_ACTIONS.updateSucceeded
      : input.status === "rolled_back"
        ? VENUE_EDGE_AUDIT_ACTIONS.updateRolledBack
        : input.status === "failed"
          ? VENUE_EDGE_AUDIT_ACTIONS.updateFailed
          : VENUE_EDGE_AUDIT_ACTIONS.updateStarted

  await writeAuditLog(auditContext, {
    action: auditAction,
    targetType: "venue_edge_installation",
    targetId: installation.id,
    metadata: {
      attemptId: input.attemptId,
      targetVersion: attempt.targetVersion,
      status: input.status,
      reasonCode: input.reasonCode ?? null,
      locationId: installation.locationId,
    },
  })

  if (input.status === "failed" || input.status === "rolled_back") {
    const [release] = await db
      .select({
        id: venueEdgeReleases.id,
        canaryInstallationIds: venueEdgeReleases.canaryInstallationIds,
      })
      .from(venueEdgeReleases)
      .where(
        and(
          eq(venueEdgeReleases.tenantId, input.tenantId),
          eq(venueEdgeReleases.id, attempt.releaseId),
          eq(venueEdgeReleases.status, "published"),
        ),
      )
      .limit(1)

    if (
      release?.canaryInstallationIds?.includes(installation.id)
    ) {
      await revokeVenueEdgeRelease(auditContext, release.id)
      await writeAuditLog(auditContext, {
        action: VENUE_EDGE_AUDIT_ACTIONS.updateFailed,
        targetType: "venue_edge_release",
        targetId: release.id,
        metadata: {
          attemptId: input.attemptId,
          installationId: installation.id,
          reasonCode: input.reasonCode ?? input.status,
          autoRevokedCanary: true,
        },
      })
    }
  }

  return {
    accepted: true,
    updateStatus,
    currentVersion: nextVersion,
  }
}
