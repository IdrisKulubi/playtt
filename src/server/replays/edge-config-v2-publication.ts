import { randomUUID } from "node:crypto"

import { and, desc, eq } from "drizzle-orm"

import db from "@/db/drizzle"
import {
  devices,
  locations,
  venueEdgeConfigRevisions,
  venueEdgeInstallations,
} from "@/db/schema"
import { DeviceError } from "@/server/devices/errors"
import {
  checksumEdgeConfigSnapshot,
  cloneCanonicalEdgeConfigSnapshot,
} from "@/server/replays/edge-config-v2-checksum"
import {
  assertEdgeConfigV2,
  EDGE_CONFIG_V2_PROTOCOL_VERSION,
  type EdgeConfigV2,
} from "@/server/replays/edge-config-v2"
import { VENUE_EDGE_V2_MINIMUM_AGENT_VERSION } from "@/server/replays/edge-config-v2-repository"
import { assertVenueEdgeConfigV2Enabled } from "@/server/replays/venue-edge-config-v2-gate"
import { VENUE_EDGE_AUDIT_ACTIONS } from "@/server/replays/venue-edge-audit-actions"
import { writeAuditLogInTransaction } from "@/server/tenancy/audit-log-write"
import type { TenantContext } from "@/server/tenancy/types"

export type EdgeConfigV2TopologySnapshot = Pick<
  EdgeConfigV2,
  "resources" | "recorders" | "sources" | "resourcePolicies"
>

export interface PublishedEdgeConfigV2Revision {
  id: string
  tenantId: string
  locationId: string
  version: number
  checksum: string
  publishedAt: string
}

function requireTopologySnapshot(input: unknown): EdgeConfigV2TopologySnapshot {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new DeviceError(
      "CONFIG_INVALID",
      "VenueEdge configuration snapshot must be an object.",
      422
    )
  }

  const snapshot = input as Record<string, unknown>
  return {
    resources: snapshot.resources as EdgeConfigV2TopologySnapshot["resources"],
    recorders: snapshot.recorders as EdgeConfigV2TopologySnapshot["recorders"],
    sources: snapshot.sources as EdgeConfigV2TopologySnapshot["sources"],
    resourcePolicies:
      snapshot.resourcePolicies as EdgeConfigV2TopologySnapshot["resourcePolicies"],
  }
}

export async function publishEdgeConfigV2Revision(input: {
  tenantId: string
  locationId: string
  snapshot: unknown
  createdByActorId?: string | null
  correlationId?: string
  now?: Date
}): Promise<PublishedEdgeConfigV2Revision> {
  await assertVenueEdgeConfigV2Enabled(input.tenantId, input.locationId)

  const publishedAt = input.now ?? new Date()
  const revisionId = randomUUID()
  const auditContext: TenantContext = {
    tenantId: input.tenantId,
    actor: input.createdByActorId
      ? { type: "user", id: input.createdByActorId }
      : { type: "service", id: "venue-edge-config" },
    correlationId:
      input.correlationId ?? `venue-edge-config-publish-${revisionId}`,
  }

  return db.transaction(async (tx) => {
    // The venue row is the per-tenant/location serialization point. This also
    // protects the no-prior-revision case from concurrent version-1 publishers.
    const [location] = await tx
      .select({ id: locations.id })
      .from(locations)
      .where(
        and(
          eq(locations.tenantId, input.tenantId),
          eq(locations.id, input.locationId)
        )
      )
      .limit(1)
      .for("update")

    if (!location) {
      throw new DeviceError(
        "CONFIG_NOT_READY",
        "VenueEdge configuration venue was not found.",
        404
      )
    }

    const [installation] = await tx
      .select({
        id: venueEdgeInstallations.id,
        installationUid: venueEdgeInstallations.installationUid,
        edgeDeviceId: venueEdgeInstallations.edgeDeviceId,
      })
      .from(venueEdgeInstallations)
      .innerJoin(
        devices,
        and(
          eq(devices.tenantId, venueEdgeInstallations.tenantId),
          eq(devices.locationId, venueEdgeInstallations.locationId),
          eq(devices.id, venueEdgeInstallations.edgeDeviceId)
        )
      )
      .where(
        and(
          eq(venueEdgeInstallations.tenantId, input.tenantId),
          eq(venueEdgeInstallations.locationId, input.locationId),
          eq(devices.type, "venue_edge"),
          eq(devices.status, "active")
        )
      )
      .limit(1)

    if (!installation) {
      throw new DeviceError(
        "CONFIG_NOT_READY",
        "An active VenueEdge installation is required before publication.",
        409
      )
    }

    const [latestRevision] = await tx
      .select({ version: venueEdgeConfigRevisions.version })
      .from(venueEdgeConfigRevisions)
      .where(
        and(
          eq(venueEdgeConfigRevisions.tenantId, input.tenantId),
          eq(venueEdgeConfigRevisions.locationId, input.locationId)
        )
      )
      .orderBy(desc(venueEdgeConfigRevisions.version))
      .limit(1)
      .for("update")

    const version = (latestRevision?.version ?? 0) + 1
    const topology = requireTopologySnapshot(input.snapshot)
    let canonicalTopology: EdgeConfigV2TopologySnapshot
    let checksumSha256: string

    try {
      canonicalTopology = cloneCanonicalEdgeConfigSnapshot(topology)
      checksumSha256 = checksumEdgeConfigSnapshot(canonicalTopology)
      assertEdgeConfigV2({
        protocolVersion: EDGE_CONFIG_V2_PROTOCOL_VERSION,
        configRevision: {
          id: revisionId,
          version,
          checksum: `sha256:${checksumSha256}`,
          publishedAt: publishedAt.toISOString(),
        },
        installation: {
          id: installation.installationUid,
          deviceId: installation.edgeDeviceId,
          tenantId: input.tenantId,
          venueId: input.locationId,
          minimumAgentVersion: VENUE_EDGE_V2_MINIMUM_AGENT_VERSION,
        },
        ...canonicalTopology,
      })
    } catch {
      throw new DeviceError(
        "CONFIG_INVALID",
        "VenueEdge configuration failed secret-free contract validation.",
        422
      )
    }

    await tx
      .update(venueEdgeConfigRevisions)
      .set({ status: "superseded" })
      .where(
        and(
          eq(venueEdgeConfigRevisions.tenantId, input.tenantId),
          eq(venueEdgeConfigRevisions.locationId, input.locationId),
          eq(venueEdgeConfigRevisions.status, "published")
        )
      )

    await tx.insert(venueEdgeConfigRevisions).values({
      id: revisionId,
      tenantId: input.tenantId,
      locationId: input.locationId,
      version,
      status: "published",
      checksumSha256,
      snapshot: canonicalTopology,
      createdByActorId: input.createdByActorId ?? null,
      publishedAt,
    })

    await writeAuditLogInTransaction(tx, auditContext, {
      action: VENUE_EDGE_AUDIT_ACTIONS.configPublished,
      targetType: "venue_edge_config_revision",
      targetId: revisionId,
      metadata: {
        locationId: input.locationId,
        version,
        checksum: `sha256:${checksumSha256}`,
      },
    })

    return {
      id: revisionId,
      tenantId: input.tenantId,
      locationId: input.locationId,
      version,
      checksum: `sha256:${checksumSha256}`,
      publishedAt: publishedAt.toISOString(),
    }
  })
}
