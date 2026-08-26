import { and, desc, eq } from "drizzle-orm"

import db from "@/db/drizzle"
import { venueEdgeConfigRevisions, venueEdgeInstallations } from "@/db/schema"
import { DeviceError } from "@/server/devices/errors"
import { assertVenueEdgeConfigV2Enabled } from "@/server/replays/venue-edge-config-v2-gate"
import {
  assertEdgeConfigV2,
  EDGE_CONFIG_V2_PROTOCOL_VERSION,
  type EdgeConfigV2,
} from "@/server/replays/edge-config-v2"

export const VENUE_EDGE_V2_MINIMUM_AGENT_VERSION = "0.2.0"

type TopologySnapshot = Pick<
  EdgeConfigV2,
  "resources" | "recorders" | "sources" | "resourcePolicies"
>

function topologyFromSnapshot(
  snapshot: Record<string, unknown>
): TopologySnapshot {
  return {
    resources: snapshot.resources as TopologySnapshot["resources"],
    recorders: snapshot.recorders as TopologySnapshot["recorders"],
    sources: snapshot.sources as TopologySnapshot["sources"],
    resourcePolicies:
      snapshot.resourcePolicies as TopologySnapshot["resourcePolicies"],
  }
}

function formatChecksum(checksum: string): string {
  return checksum.startsWith("sha256:")
    ? checksum.toLowerCase()
    : `sha256:${checksum.toLowerCase()}`
}

export async function getPublishedEdgeConfigV2ForDevice(input: {
  tenantId: string
  locationId: string
  deviceId: string
  deviceType: string
}): Promise<EdgeConfigV2> {
  if (input.deviceType !== "venue_edge") {
    throw new DeviceError(
      "DEVICE_FORBIDDEN",
      "Only a VenueEdge device can request edge configuration v2.",
      403
    )
  }

  await assertVenueEdgeConfigV2Enabled(input.tenantId, input.locationId)

  const [installation] = await db
    .select({
      id: venueEdgeInstallations.id,
      installationUid: venueEdgeInstallations.installationUid,
    })
    .from(venueEdgeInstallations)
    .where(
      and(
        eq(venueEdgeInstallations.tenantId, input.tenantId),
        eq(venueEdgeInstallations.locationId, input.locationId),
        eq(venueEdgeInstallations.edgeDeviceId, input.deviceId)
      )
    )
    .limit(1)

  if (!installation) {
    throw new DeviceError(
      "CONFIG_NOT_READY",
      "VenueEdge installation setup is not complete.",
      409
    )
  }

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
        eq(venueEdgeConfigRevisions.tenantId, input.tenantId),
        eq(venueEdgeConfigRevisions.locationId, input.locationId),
        eq(venueEdgeConfigRevisions.status, "published")
      )
    )
    .orderBy(desc(venueEdgeConfigRevisions.version))
    .limit(1)

  if (!revision?.publishedAt) {
    throw new DeviceError(
      "CONFIG_NOT_READY",
      "VenueEdge configuration has not been published.",
      409
    )
  }

  const topology = topologyFromSnapshot(revision.snapshot ?? {})
  try {
    return assertEdgeConfigV2({
      protocolVersion: EDGE_CONFIG_V2_PROTOCOL_VERSION,
      configRevision: {
        id: revision.id,
        version: revision.version,
        checksum: formatChecksum(revision.checksumSha256),
        publishedAt: revision.publishedAt.toISOString(),
      },
      installation: {
        id: installation.installationUid,
        deviceId: input.deviceId,
        tenantId: input.tenantId,
        venueId: input.locationId,
        minimumAgentVersion: VENUE_EDGE_V2_MINIMUM_AGENT_VERSION,
      },
      ...topology,
    })
  } catch {
    throw new DeviceError(
      "CONFIG_INVALID",
      "Published VenueEdge configuration failed validation.",
      503
    )
  }
}
