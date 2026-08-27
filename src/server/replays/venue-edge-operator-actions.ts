import { and, eq } from "drizzle-orm"

import db from "@/db/drizzle"
import {
  replaySourcePolicies,
  replaySourceRoutes,
  venueEdgeInstallations,
} from "@/db/schema"
import {
  revokeDeviceForOperator,
  rotateDeviceCredentialForOperator,
} from "@/server/devices/devices-service"
import { DeviceError } from "@/server/devices/errors"
import { VENUE_EDGE_AUDIT_ACTIONS } from "@/server/replays/venue-edge-audit-actions"
import { publishEdgeConfigV2Revision } from "@/server/replays/edge-config-v2-publication"
import {
  buildTopologySnapshotForLocation,
  ingestCommissioningSnapshotForLocation,
  parseCommissioningSnapshot,
  rollbackVenueEdgeConfigRevision,
  syncCommissioningAndPublish,
} from "@/server/replays/venue-edge-topology"
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

export async function renameVenueEdgeInstallation(
  context: TenantContext,
  installationId: string,
  displayName: string,
  reason?: string,
) {
  const trimmedName = displayName.trim()
  if (!trimmedName) {
    throw new DeviceError(
      "VALIDATION_ERROR",
      "Display name cannot be empty.",
      400,
    )
  }

  const auditReason = requireReason(reason)
  const installation = await getInstallationForTenant(
    context.tenantId,
    installationId,
  )

  await db
    .update(venueEdgeInstallations)
    .set({ displayName: trimmedName, updatedAt: new Date() })
    .where(
      and(
        eq(venueEdgeInstallations.tenantId, context.tenantId),
        eq(venueEdgeInstallations.id, installationId),
      ),
    )

  await writeAuditLog(context, {
    action: "venue_edge.installation.rename",
    targetType: "venue_edge_installation",
    targetId: installationId,
    metadata: {
      previousName: installation.displayName,
      displayName: trimmedName,
      reason: auditReason,
    },
  })

  return { id: installationId, displayName: trimmedName }
}

export async function syncVenueEdgeCommissioning(
  context: TenantContext,
  installationId: string,
  reason?: string,
) {
  const auditReason = requireReason(reason)
  const installation = await getInstallationForTenant(
    context.tenantId,
    installationId,
  )
  const snapshot = parseCommissioningSnapshot(
    installation.commissioningSnapshotJson,
  )

  if (!snapshot) {
    throw new DeviceError(
      "CONFIG_NOT_READY",
      "No commissioning snapshot is available for this installation.",
      409,
    )
  }

  const result = await syncCommissioningAndPublish({
    tenantId: context.tenantId,
    locationId: installation.locationId,
    edgeDeviceId: installation.edgeDeviceId,
    snapshot,
    createdByActorId: context.actor.type === "user" ? context.actor.id : null,
    correlationId: context.correlationId,
  })

  await writeAuditLog(context, {
    action: VENUE_EDGE_AUDIT_ACTIONS.configPublished,
    targetType: "venue_edge_installation",
    targetId: installationId,
    metadata: {
      reason: auditReason,
      revisionVersion: result.revision.version,
      ingested: result.ingested,
    },
  })

  return result
}

export async function rollbackVenueEdgeInstallationConfig(
  context: TenantContext,
  installationId: string,
  revisionId: string,
  reason?: string,
) {
  const auditReason = requireReason(reason)
  const installation = await getInstallationForTenant(
    context.tenantId,
    installationId,
  )

  const revision = await rollbackVenueEdgeConfigRevision({
    tenantId: context.tenantId,
    locationId: installation.locationId,
    revisionId,
    createdByActorId: context.actor.type === "user" ? context.actor.id : null,
    correlationId: context.correlationId,
  })

  await writeAuditLog(context, {
    action: VENUE_EDGE_AUDIT_ACTIONS.configRollback,
    targetType: "venue_edge_installation",
    targetId: installationId,
    metadata: {
      reason: auditReason,
      rollbackFromRevisionId: revisionId,
      revisionVersion: revision.version,
    },
  })

  return revision
}

export async function updateVenueEdgeResourcePolicy(
  context: TenantContext,
  locationId: string,
  resourceId: string,
  input: {
    selectionMode?: "automatic" | "manual"
    manualSourceId?: string | null
    candidates?: Array<{
      sourceId: string
      priority: number
      captureModes: Array<"edge_buffer" | "nvr_playback">
      enabled?: boolean
    }>
    clearOverride?: boolean
    reason?: string
  },
) {
  const auditReason = requireReason(input.reason)
  const now = new Date()

  await db.transaction(async (tx) => {
    const [policy] = await tx
      .select()
      .from(replaySourcePolicies)
      .where(
        and(
          eq(replaySourcePolicies.tenantId, context.tenantId),
          eq(replaySourcePolicies.locationId, locationId),
          eq(replaySourcePolicies.resourceId, resourceId),
        ),
      )
      .limit(1)

    if (!policy) {
      throw new DeviceError(
        "VALIDATION_ERROR",
        "Resource source policy was not found for this venue.",
        404,
      )
    }

    const nextSelectionMode = input.selectionMode ?? policy.selectionMode
    const nextManualSourceId = input.clearOverride
      ? null
      : input.manualSourceId ?? policy.manualSourceId

    await tx
      .update(replaySourcePolicies)
      .set({
        selectionMode: nextSelectionMode,
        manualSourceId: nextManualSourceId,
        overrideActorId: input.clearOverride ? null : policy.overrideActorId,
        overrideReason: input.clearOverride ? null : policy.overrideReason,
        overrideExpiresAt: input.clearOverride ? null : policy.overrideExpiresAt,
        updatedAt: now,
      })
      .where(
        and(
          eq(replaySourcePolicies.tenantId, context.tenantId),
          eq(replaySourcePolicies.locationId, locationId),
          eq(replaySourcePolicies.resourceId, resourceId),
        ),
      )

    if (input.candidates) {
      await tx
        .delete(replaySourceRoutes)
        .where(
          and(
            eq(replaySourceRoutes.tenantId, context.tenantId),
            eq(replaySourceRoutes.locationId, locationId),
            eq(replaySourceRoutes.resourceId, resourceId),
          ),
        )

      for (const candidate of input.candidates) {
        await tx.insert(replaySourceRoutes).values({
          tenantId: context.tenantId,
          locationId,
          resourceId,
          cameraSourceId: candidate.sourceId,
          priority: candidate.priority,
          captureModes: candidate.captureModes,
          policy: {},
          isEnabled: candidate.enabled !== false,
          updatedAt: now,
        })
      }
    }
  })

  const topology = await buildTopologySnapshotForLocation(
    context.tenantId,
    locationId,
  )
  const revision = await publishEdgeConfigV2Revision({
    tenantId: context.tenantId,
    locationId,
    snapshot: topology,
    createdByActorId: context.actor.type === "user" ? context.actor.id : null,
    correlationId: context.correlationId,
  })

  await writeAuditLog(context, {
    action: VENUE_EDGE_AUDIT_ACTIONS.configPublished,
    targetType: "replay_source_policy",
    targetId: resourceId,
    metadata: {
      reason: auditReason,
      revisionVersion: revision.version,
      selectionMode: input.selectionMode,
      clearOverride: input.clearOverride ?? false,
    },
  })

  return revision
}

export async function revokeVenueEdgeInstallation(
  context: TenantContext,
  installationId: string,
  reason?: string,
) {
  const auditReason = requireReason(reason)
  const installation = await getInstallationForTenant(
    context.tenantId,
    installationId,
  )

  const device = await revokeDeviceForOperator(
    context,
    installation.edgeDeviceId,
  )

  await writeAuditLog(context, {
    action: "venue_edge.installation.revoke",
    targetType: "venue_edge_installation",
    targetId: installationId,
    metadata: {
      reason: auditReason,
      edgeDeviceId: installation.edgeDeviceId,
    },
  })

  return device
}

export async function rotateVenueEdgeInstallationCredential(
  context: TenantContext,
  installationId: string,
  reason?: string,
) {
  const auditReason = requireReason(reason)
  const installation = await getInstallationForTenant(
    context.tenantId,
    installationId,
  )

  const rotated = await rotateDeviceCredentialForOperator(
    context,
    installation.edgeDeviceId,
  )

  await writeAuditLog(context, {
    action: "venue_edge.installation.rotate_credential",
    targetType: "venue_edge_installation",
    targetId: installationId,
    metadata: {
      reason: auditReason,
      credentialVersion: rotated.credentialVersion,
    },
  })

  return rotated
}
