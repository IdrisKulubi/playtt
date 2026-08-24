import { authorize } from "@/server/tenancy/authorize-context.mjs"
import type { TenantContext } from "@/server/tenancy/types"
import {
  fetchTenantWorkerHealth,
  fetchVenueHealthRows,
} from "@/server/operations/health-repository"
import {
  buildHealthDimension,
  evaluateCommandDimension,
  evaluateDeviceDimension,
  evaluateEdgeDimension,
  evaluateAccessDimension,
  evaluateInfrastructureProbe,
  evaluateNetworkDimension,
  evaluateReplayDimension,
  evaluateSessionDimension,
  evaluateWorkerDimension,
  rollupHealthStatus,
  type HealthDimension,
  type TenantHealthOverview,
  type VenueHealthSnapshot,
} from "@/server/operations/health-status"
import { probeInfrastructure } from "@/server/operations/infrastructure-probes"

function buildVenueDimensions(
  row: Awaited<ReturnType<typeof fetchVenueHealthRows>>[number],
): HealthDimension[] {
  return [
    buildHealthDimension(
      "devices",
      evaluateDeviceDimension(row.deviceHealths),
      `/admin/devices?venueId=${row.venueId}`,
    ),
    buildHealthDimension(
      "edge",
      evaluateEdgeDimension(row.edge),
      `/admin/venues/${row.venueId}`,
    ),
    buildHealthDimension(
      "sessions",
      evaluateSessionDimension(row.stuckSessionCount),
      "/admin/bookings",
    ),
    buildHealthDimension(
      "replay",
      evaluateReplayDimension(
        row.replayFailedCount,
        row.replayInFlightCount,
      ),
      `/admin/venues/${row.venueId}`,
    ),
    buildHealthDimension(
      "commands",
      evaluateCommandDimension(row.failedCommandCount),
      `/admin/devices?venueId=${row.venueId}`,
    ),
    buildHealthDimension(
      "access",
      evaluateAccessDimension({
        accessPointCount: row.accessPointCount,
        failedCredentialCount: row.failedAccessCredentialCount,
        pendingCredentialCount: row.pendingAccessCredentialCount,
      }),
      "/admin/bookings",
    ),
    buildHealthDimension(
      "network",
      evaluateNetworkDimension(row.edge),
      `/admin/venues/${row.venueId}`,
    ),
  ]
}

function buildVenueSnapshot(
  row: Awaited<ReturnType<typeof fetchVenueHealthRows>>[number],
): VenueHealthSnapshot {
  const dimensions = buildVenueDimensions(row)

  return {
    venueId: row.venueId,
    venueName: row.venueName,
    status: rollupHealthStatus(...dimensions.map((dimension) => dimension.status)),
    dimensions,
  }
}

async function buildTenantHealthOverview(
  context: TenantContext,
  locationId?: string,
): Promise<TenantHealthOverview> {
  const [venueRows, workerHealth, infrastructure] = await Promise.all([
    fetchVenueHealthRows(context, locationId),
    locationId ? null : fetchTenantWorkerHealth(context),
    locationId ? null : probeInfrastructure(),
  ])

  const venues = venueRows.map(buildVenueSnapshot)
  const tenantDimensions: HealthDimension[] = []

  if (workerHealth) {
    tenantDimensions.push(
      buildHealthDimension(
        "workers",
        evaluateWorkerDimension(workerHealth),
        "/admin/durable-work",
      ),
    )
  }

  if (infrastructure) {
    tenantDimensions.push(
      buildHealthDimension(
        "database",
        evaluateInfrastructureProbe(infrastructure.database),
        "/admin/health",
      ),
      buildHealthDimension(
        "redis",
        evaluateInfrastructureProbe(infrastructure.redis),
        "/admin/health",
      ),
      buildHealthDimension(
        "storage",
        evaluateInfrastructureProbe(infrastructure.storage),
        "/admin/health",
      ),
    )
  }

  const rollupStatuses = [
    ...tenantDimensions.map((dimension) => dimension.status),
    ...venues.map((venue) => venue.status),
  ]

  return {
    status: rollupHealthStatus(...rollupStatuses),
    generatedAt: new Date().toISOString(),
    tenantDimensions,
    venues,
  }
}

export async function getTenantHealthOverview(
  context: TenantContext,
): Promise<TenantHealthOverview> {
  authorize(context, "venue.read")
  return buildTenantHealthOverview(context)
}

export async function getVenueHealthSnapshot(
  context: TenantContext,
  locationId: string,
): Promise<VenueHealthSnapshot | null> {
  authorize(context, "venue.read")
  const overview = await buildTenantHealthOverview(context, locationId)
  return overview.venues[0] ?? null
}
