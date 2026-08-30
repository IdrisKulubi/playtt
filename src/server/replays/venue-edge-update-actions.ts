import { and, desc, eq } from "drizzle-orm"

import db from "@/db/drizzle"
import { venueEdgeInstallations, venueEdgeUpdateAttempts } from "@/db/schema"
import { DeviceError } from "@/server/devices/errors"
import { VENUE_EDGE_AUDIT_ACTIONS } from "@/server/replays/venue-edge-audit-actions"
import {
  publishVenueEdgeRelease,
  revokeVenueEdgeRelease,
} from "@/server/replays/venue-edge-releases"
import { writeAuditLog } from "@/server/tenancy/audit-log-write"
import type { TenantContext } from "@/server/tenancy/types"

function requireReason(reason: string | undefined) {
  const trimmed = reason?.trim()
  if (!trimmed || trimmed.length < 4) {
    throw new DeviceError(
      "VALIDATION_ERROR",
      "A short reason is required for this action.",
      400,
    )
  }

  return trimmed
}

async function getInstallationForTenant(
  tenantId: string,
  installationId: string,
) {
  const [installation] = await db
    .select()
    .from(venueEdgeInstallations)
    .where(
      and(
        eq(venueEdgeInstallations.tenantId, tenantId),
        eq(venueEdgeInstallations.id, installationId),
      ),
    )
    .limit(1)

  if (!installation) {
    throw new DeviceError(
      "VALIDATION_ERROR",
      "VenueEdge installation was not found.",
      404,
    )
  }

  return installation
}

export async function changeVenueEdgeUpdateChannel(
  context: TenantContext,
  installationId: string,
  channel: string,
  reason?: string,
) {
  const auditReason = requireReason(reason)
  const installation = await getInstallationForTenant(
    context.tenantId,
    installationId,
  )

  await db
    .update(venueEdgeInstallations)
    .set({
      updateChannel: channel,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(venueEdgeInstallations.tenantId, context.tenantId),
        eq(venueEdgeInstallations.id, installationId),
      ),
    )

  await writeAuditLog(context, {
    action: VENUE_EDGE_AUDIT_ACTIONS.updateChannelChanged,
    targetType: "venue_edge_installation",
    targetId: installationId,
    metadata: {
      previousChannel: installation.updateChannel,
      channel,
      reason: auditReason,
    },
  })

  return { id: installationId, updateChannel: channel }
}

export async function pinVenueEdgeInstallationVersion(
  context: TenantContext,
  installationId: string,
  version: string | null,
  reason?: string,
) {
  const auditReason = requireReason(reason)
  const installation = await getInstallationForTenant(
    context.tenantId,
    installationId,
  )

  await db
    .update(venueEdgeInstallations)
    .set({
      pinnedVersion: version,
      desiredAgentVersion: version,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(venueEdgeInstallations.tenantId, context.tenantId),
        eq(venueEdgeInstallations.id, installationId),
      ),
    )

  await writeAuditLog(context, {
    action: VENUE_EDGE_AUDIT_ACTIONS.updatePinned,
    targetType: "venue_edge_installation",
    targetId: installationId,
    metadata: {
      previousPinnedVersion: installation.pinnedVersion,
      pinnedVersion: version,
      reason: auditReason,
    },
  })

  return { id: installationId, pinnedVersion: version }
}

export async function requestVenueEdgeUpdateRetry(
  context: TenantContext,
  installationId: string,
  reason?: string,
) {
  const auditReason = requireReason(reason)
  await getInstallationForTenant(context.tenantId, installationId)

  await db
    .update(venueEdgeInstallations)
    .set({
      updateStatus: "idle",
      activeUpdateAttemptId: null,
      lastUpdateErrorCode: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(venueEdgeInstallations.tenantId, context.tenantId),
        eq(venueEdgeInstallations.id, installationId),
      ),
    )

  await writeAuditLog(context, {
    action: VENUE_EDGE_AUDIT_ACTIONS.updateRetryRequested,
    targetType: "venue_edge_installation",
    targetId: installationId,
    metadata: { reason: auditReason },
  })

  return { id: installationId, updateStatus: "idle" }
}

export async function requestVenueEdgeUpdateRollback(
  context: TenantContext,
  installationId: string,
  reason?: string,
) {
  const auditReason = requireReason(reason)
  const installation = await getInstallationForTenant(
    context.tenantId,
    installationId,
  )

  const [lastSuccess] = await db
    .select({
      targetVersion: venueEdgeUpdateAttempts.targetVersion,
    })
    .from(venueEdgeUpdateAttempts)
    .where(
      and(
        eq(venueEdgeUpdateAttempts.tenantId, context.tenantId),
        eq(venueEdgeUpdateAttempts.installationId, installationId),
        eq(venueEdgeUpdateAttempts.status, "succeeded"),
      ),
    )
    .orderBy(desc(venueEdgeUpdateAttempts.finishedAt))
    .limit(1)

  const rollbackVersion =
    lastSuccess?.targetVersion ?? installation.currentAgentVersion

  await db
    .update(venueEdgeInstallations)
    .set({
      pinnedVersion: rollbackVersion,
      desiredAgentVersion: rollbackVersion,
      updateStatus: "rolled_back",
      activeUpdateAttemptId: null,
      lastUpdateErrorCode: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(venueEdgeInstallations.tenantId, context.tenantId),
        eq(venueEdgeInstallations.id, installationId),
      ),
    )

  await writeAuditLog(context, {
    action: VENUE_EDGE_AUDIT_ACTIONS.updateRolledBack,
    targetType: "venue_edge_installation",
    targetId: installationId,
    metadata: {
      reason: auditReason,
      rollbackVersion,
      previousPinnedVersion: installation.pinnedVersion,
      previousDesiredVersion: installation.desiredAgentVersion,
    },
  })

  return {
    id: installationId,
    pinnedVersion: rollbackVersion,
    updateStatus: "rolled_back",
  }
}

export async function publishVenueEdgeReleaseForOperator(
  context: TenantContext,
  releaseId: string,
  reason?: string,
) {
  const auditReason = requireReason(reason)
  const release = await publishVenueEdgeRelease(context, releaseId)

  await writeAuditLog(context, {
    action: VENUE_EDGE_AUDIT_ACTIONS.updateStarted,
    targetType: "venue_edge_release",
    targetId: release.id,
    metadata: {
      version: release.version,
      channel: release.channel,
      reason: auditReason,
    },
  })

  return release
}

export async function revokeVenueEdgeReleaseForOperator(
  context: TenantContext,
  releaseId: string,
  reason?: string,
) {
  const auditReason = requireReason(reason)
  const release = await revokeVenueEdgeRelease(context, releaseId)

  await writeAuditLog(context, {
    action: VENUE_EDGE_AUDIT_ACTIONS.updateFailed,
    targetType: "venue_edge_release",
    targetId: release.id,
    metadata: {
      version: release.version,
      channel: release.channel,
      reason: auditReason,
      revoked: true,
    },
  })

  return release
}
