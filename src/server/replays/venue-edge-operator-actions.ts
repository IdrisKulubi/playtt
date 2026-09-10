import { and, desc, eq } from "drizzle-orm"

import db from "@/db/drizzle"
import {
  replaySourcePolicies,
  replaySourceRoutes,
  venueEdgeConfigApplications,
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
    installationId: installation.id,
    reportVersion: installation.lastReportVersion,
    reportChecksumSha256: installation.lastReportChecksumSha256,
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

export async function reconcileVenueEdgeSnapshot(
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
  let ingested: Awaited<
    ReturnType<typeof ingestCommissioningSnapshotForLocation>
  >
  try {
    ingested = await ingestCommissioningSnapshotForLocation({
      tenantId: context.tenantId,
      locationId: installation.locationId,
      edgeDeviceId: installation.edgeDeviceId,
      installationId: installation.id,
      reportVersion: installation.lastReportVersion,
      reportChecksumSha256: installation.lastReportChecksumSha256,
      snapshot,
    })
  } catch (error) {
    if (error instanceof DeviceError) {
      throw error
    }

    const databaseError = findDatabaseErrorMetadata(error)
    console.error("VenueEdge snapshot reconciliation failed", {
      installationId,
      locationId: installation.locationId,
      ...databaseError,
    })
    throw new DeviceError(
      "CONFIG_INVALID",
      "PlayTT could not apply the reviewed camera mappings. No configuration was published. Refresh this page and try Publish reviewed configuration again.",
      500,
    )
  }
  await writeAuditLog(context, {
    action: "venue_edge.topology.reconciled",
    targetType: "venue_edge_installation",
    targetId: installationId,
    metadata: { reason: auditReason, ingested },
  })
  return ingested
}

function findDatabaseErrorMetadata(error: unknown) {
  let current: unknown = error
  for (let depth = 0; depth < 4 && current instanceof Error; depth += 1) {
    const candidate = current as Error & {
      code?: unknown
      constraint?: unknown
      cause?: unknown
    }
    if (
      typeof candidate.code === "string" ||
      typeof candidate.constraint === "string"
    ) {
      return {
        databaseCode:
          typeof candidate.code === "string" ? candidate.code : "unknown",
        constraint:
          typeof candidate.constraint === "string"
            ? candidate.constraint
            : "unknown",
      }
    }
    current = candidate.cause
  }
  return { databaseCode: "unknown", constraint: "unknown" }
}

export async function publishVenueEdgeInstallationConfig(
  context: TenantContext,
  installationId: string,
  reason?: string,
  minimumVersionExclusive?: number,
) {
  const auditReason = requireReason(reason)
  const installation = await getInstallationForTenant(
    context.tenantId,
    installationId,
  )
  const topology = await buildTopologySnapshotForLocation(
    context.tenantId,
    installation.locationId,
    installation.id,
  )
  const revision = await publishEdgeConfigV2Revision({
    tenantId: context.tenantId,
    locationId: installation.locationId,
    snapshot: topology,
    createdByActorId: context.actor.type === "user" ? context.actor.id : null,
    correlationId: context.correlationId,
    minimumVersionExclusive,
    commissioningInstallationId: installation.id,
    sourceReportVersion: installation.lastReportVersion,
    sourceReportChecksumSha256: installation.lastReportChecksumSha256,
  })
  await writeAuditLog(context, {
    action: VENUE_EDGE_AUDIT_ACTIONS.configPublished,
    targetType: "venue_edge_installation",
    targetId: installationId,
    metadata: {
      reason: auditReason,
      revisionVersion: revision.version,
      mode: "publish_only",
    },
  })
  return revision
}

function safeNumber(details: Record<string, unknown> | null, keys: string[]) {
  for (const key of keys) {
    const value = details?.[key]
    if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0)
      return value
  }
  return null
}

function safeString(details: Record<string, unknown> | null, keys: string[]) {
  for (const key of keys) {
    const value = details?.[key]
    if (typeof value === "string" && value.trim()) return value.trim()
  }
  return null
}

export async function recoverVenueEdgeStaleConfig(
  context: TenantContext,
  installationId: string,
  reason?: string,
) {
  const installation = await getInstallationForTenant(
    context.tenantId,
    installationId,
  )
  const [application] = await db
    .select({
      errorCode: venueEdgeConfigApplications.errorCode,
      errorDetails: venueEdgeConfigApplications.errorDetails,
    })
    .from(venueEdgeConfigApplications)
    .where(
      and(
        eq(venueEdgeConfigApplications.tenantId, context.tenantId),
        eq(venueEdgeConfigApplications.locationId, installation.locationId),
        eq(venueEdgeConfigApplications.edgeDeviceId, installation.edgeDeviceId),
      ),
    )
    .orderBy(desc(venueEdgeConfigApplications.attemptedAt))
    .limit(1)

  const details = application?.errorDetails ?? null
  const staleReason = safeString(details, ["reason", "staleReason"])
  if (application?.errorCode !== "CONFIG_STALE") {
    throw new DeviceError(
      "CONFIG_NOT_READY",
      "The latest configuration was not rejected as stale.",
      409,
    )
  }
  if (staleReason === "installation_mismatch") {
    throw new DeviceError(
      "CONFIG_NOT_READY",
      "The venue PC belongs to a different installation. Reset its local installation cache or use Replace PC before retrying.",
      409,
    )
  }
  if (staleReason !== "version_not_newer") {
    throw new DeviceError(
      "CONFIG_NOT_READY",
      "The stale configuration reason is unknown. Review the venue PC before retrying.",
      409,
    )
  }
  const localInstallationId = safeString(details, ["localInstallationId"])
  if (
    localInstallationId &&
    localInstallationId !== installation.installationUid
  ) {
    throw new DeviceError(
      "CONFIG_NOT_READY",
      "The venue PC installation identity does not match this installation.",
      409,
    )
  }
  const localVersion = safeNumber(details, ["localVersion", "appliedVersion"])
  if (localVersion === null) {
    throw new DeviceError(
      "CONFIG_NOT_READY",
      "The venue PC did not report its local configuration version.",
      409,
    )
  }
  return publishVenueEdgeInstallationConfig(
    context,
    installationId,
    reason,
    localVersion,
  )
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
  let topologyInstallationId: string | undefined

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
    topologyInstallationId = policy.installationId ?? undefined

    const nextSelectionMode = input.selectionMode ?? policy.selectionMode
    const nextManualSourceId = input.clearOverride
      ? null
      : (input.manualSourceId ?? policy.manualSourceId)

    await tx
      .update(replaySourcePolicies)
      .set({
        selectionMode: nextSelectionMode,
        manualSourceId: nextManualSourceId,
        overrideActorId: input.clearOverride ? null : policy.overrideActorId,
        overrideReason: input.clearOverride ? null : policy.overrideReason,
        overrideExpiresAt: input.clearOverride
          ? null
          : policy.overrideExpiresAt,
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
          installationId: policy.installationId,
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
    topologyInstallationId,
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

  const retiredAt = new Date()
  await db
    .update(venueEdgeInstallations)
    .set({ retiredAt, updatedAt: retiredAt })
    .where(
      and(
        eq(venueEdgeInstallations.tenantId, context.tenantId),
        eq(venueEdgeInstallations.id, installationId),
      ),
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

  return { ...device, retiredAt: retiredAt.toISOString() }
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
