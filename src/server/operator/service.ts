import {
  listAccessPointsForCatalog,
  listRequiredAccessPointsByResourceIdsForCatalog,
} from "@/server/catalog/access-points-service"
import {
  getCatalogOverview as getCatalogOverviewFromRepository,
  listCapabilities as listCapabilitiesFromRepository,
  listFeatureFlags as listFeatureFlagsFromRepository,
  upsertFeatureFlagRow,
  listMemberships as listMembershipsFromRepository,
  listResourceTypes as listResourceTypesFromRepository,
  listResources as listResourcesFromRepository,
  listVenues as listVenuesFromRepository,
  listZones as listZonesFromRepository,
} from "@/server/operator/repository"
import type {
  OperatorAccessPoint,
  OperatorCatalogOverview,
  OperatorCapability,
  OperatorFeatureFlag,
  OperatorMembership,
  OperatorResource,
  OperatorResourceType,
  OperatorVenue,
  OperatorZone,
} from "@/server/operator/types"
import { authorize } from "@/server/tenancy/authorize-context.mjs"
import db from "@/db/drizzle"
import {
  REPLAY_EDGE_FLAG_KEY,
  VENUE_EDGE_CONFIG_V2_FLAG_KEY,
} from "@/server/replays/feature-policy"
import { VENUE_EDGE_AUDIT_ACTIONS } from "@/server/replays/venue-edge-audit-actions"
import { writeAuditLogInTransaction } from "@/server/tenancy/audit-log-write"
import type { TenantContext } from "@/server/tenancy/types"

const VENUE_EDGE_ROLLOUT_FLAG_KEYS = new Set([
  REPLAY_EDGE_FLAG_KEY,
  VENUE_EDGE_CONFIG_V2_FLAG_KEY,
])

function mapFeatureFlagRow(row: {
  id: string
  tenantId: string
  key: string
  enabled: boolean
  scope: Record<string, unknown> | null
  createdAt: Date
  updatedAt: Date
}): OperatorFeatureFlag {
  return {
    id: row.id,
    tenantId: row.tenantId,
    key: row.key,
    enabled: row.enabled,
    scope: row.scope ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export async function getCatalogOverview(
  context: TenantContext,
): Promise<OperatorCatalogOverview> {
  authorize(context, "catalog.read")
  return getCatalogOverviewFromRepository(context)
}

export async function listMemberships(
  context: TenantContext,
): Promise<OperatorMembership[]> {
  authorize(context, "membership.read")
  return listMembershipsFromRepository(context)
}

export async function listFeatureFlags(
  context: TenantContext,
): Promise<OperatorFeatureFlag[]> {
  authorize(context, "catalog.read")
  return listFeatureFlagsFromRepository(context)
}

export async function setFeatureFlagEnabled(
  context: TenantContext,
  key: string,
  enabled: boolean,
  scope?: Record<string, unknown> | null,
): Promise<OperatorFeatureFlag> {
  authorize(context, "catalog.manage")

  return db.transaction(async (tx) => {
    const row = await upsertFeatureFlagRow(tx, context, key, enabled, scope)

    if (VENUE_EDGE_ROLLOUT_FLAG_KEYS.has(key)) {
      await writeAuditLogInTransaction(tx, context, {
        action: VENUE_EDGE_AUDIT_ACTIONS.rolloutUpdated,
        targetType: "feature_flag",
        targetId: key,
        metadata: {
          enabled,
          scope: row.scope ?? null,
        },
      })
    }

    return mapFeatureFlagRow(row)
  })
}

export async function listVenues(context: TenantContext): Promise<OperatorVenue[]> {
  authorize(context, "catalog.read")
  return listVenuesFromRepository(context)
}

export async function listZones(
  context: TenantContext,
  locationId: string,
): Promise<OperatorZone[]> {
  authorize(context, "catalog.read")
  return listZonesFromRepository(context, locationId)
}

export async function listResources(
  context: TenantContext,
  locationId: string,
): Promise<OperatorResource[]> {
  authorize(context, "catalog.read")
  return listResourcesFromRepository(context, locationId)
}

export async function listResourceTypes(
  context: TenantContext,
): Promise<OperatorResourceType[]> {
  authorize(context, "catalog.read")
  return listResourceTypesFromRepository(context)
}

export async function listCapabilities(
  context: TenantContext,
  resourceId: string,
): Promise<OperatorCapability[]> {
  authorize(context, "catalog.read")
  return listCapabilitiesFromRepository(context, resourceId)
}

export interface OperatorVenueCatalogDetail {
  venue: OperatorVenue
  zones: OperatorZone[]
  resources: OperatorResource[]
  resourceTypes: OperatorResourceType[]
  capabilitiesByResourceId: Record<string, OperatorCapability[]>
  accessPoints: OperatorAccessPoint[]
  requiredAccessPointsByResourceId: Record<string, OperatorAccessPoint[]>
}

export async function getVenueCatalogDetail(
  context: TenantContext,
  venueId: string,
): Promise<OperatorVenueCatalogDetail | null> {
  authorize(context, "catalog.read")

  const venues = await listVenuesFromRepository(context)
  const venue = venues.find((row) => row.id === venueId)

  if (!venue) {
    return null
  }

  const zones = await listZonesFromRepository(context, venueId)
  const resources = await listResourcesFromRepository(context, venueId)
  const resourceTypes = await listResourceTypesFromRepository(context)
  const accessPoints = await listAccessPointsForCatalog(context, venueId)
  const capabilitiesByResourceId: Record<string, OperatorCapability[]> = {}
  const resourceIds = resources.map((resource) => resource.id)
  const requiredAccessPointsByResourceId =
    await listRequiredAccessPointsByResourceIdsForCatalog(context, resourceIds)

  for (const resource of resources) {
    capabilitiesByResourceId[resource.id] = await listCapabilitiesFromRepository(
      context,
      resource.id,
    )
  }

  return {
    venue,
    zones,
    resources,
    resourceTypes,
    capabilitiesByResourceId,
    accessPoints,
    requiredAccessPointsByResourceId,
  }
}
