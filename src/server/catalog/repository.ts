import { and, asc, eq, inArray, isNull } from "drizzle-orm"

import db from "@/db/drizzle"
import {
  locations,
  resourceCapabilities,
  resources,
} from "@/db/schema"
import { mapLocationToVenue } from "@/server/catalog/map-venue"
import type {
  PublicResource,
  PublicVenue,
  PublicVenueDetail,
} from "@/server/catalog/types"
import type { TenantContext } from "@/server/tenancy/types"

function mapPublicVenue(row: typeof locations.$inferSelect): PublicVenue {
  const venue = mapLocationToVenue(row)

  return {
    venueId: venue.venueId,
    name: venue.name,
    slug: venue.slug,
    address: venue.address,
    timezone: venue.timezone,
    isActive: venue.isActive,
    tenantId: venue.tenantId,
    brandId: venue.brandId,
    settings: venue.settings,
  }
}

function mapPublicResource(
  row: typeof resources.$inferSelect,
  capabilities: string[],
): PublicResource {
  return {
    resourceId: row.id,
    venueId: row.locationId,
    name: row.name,
    slug: row.slug,
    type: row.type,
    capacity: row.capacity,
    code: row.code ?? null,
    zoneId: row.zoneId ?? null,
    resourceTypeId: row.resourceTypeId ?? null,
    ruleset: row.ruleset ?? null,
    capabilities,
  }
}

async function listCapabilitiesByResourceIds(
  context: TenantContext,
  resourceIds: string[],
): Promise<Map<string, string[]>> {
  const capabilityMap = new Map<string, string[]>()

  if (resourceIds.length === 0) {
    return capabilityMap
  }

  const rows = await db
    .select({
      resourceId: resourceCapabilities.resourceId,
      code: resourceCapabilities.code,
    })
    .from(resourceCapabilities)
    .where(
      and(
        eq(resourceCapabilities.tenantId, context.tenantId),
        inArray(resourceCapabilities.resourceId, resourceIds),
      ),
    )
    .orderBy(asc(resourceCapabilities.code))

  for (const row of rows) {
    const existing = capabilityMap.get(row.resourceId) ?? []
    existing.push(row.code)
    capabilityMap.set(row.resourceId, existing)
  }

  return capabilityMap
}

export async function listPublicVenues(
  context: TenantContext,
): Promise<PublicVenue[]> {
  const rows = await db
    .select()
    .from(locations)
    .where(
      and(
        eq(locations.tenantId, context.tenantId),
        eq(locations.isActive, true),
        isNull(locations.archivedAt),
      ),
    )
    .orderBy(asc(locations.name))

  return rows.map(mapPublicVenue)
}

export async function getPublicVenueById(
  context: TenantContext,
  venueId: string,
): Promise<PublicVenue | null> {
  const [row] = await db
    .select()
    .from(locations)
    .where(
      and(
        eq(locations.tenantId, context.tenantId),
        eq(locations.id, venueId),
        eq(locations.isActive, true),
        isNull(locations.archivedAt),
      ),
    )
    .limit(1)

  return row ? mapPublicVenue(row) : null
}

export async function listPublicResourcesForVenue(
  context: TenantContext,
  venueId: string,
): Promise<PublicResource[]> {
  const rows = await db
    .select()
    .from(resources)
    .where(
      and(
        eq(resources.tenantId, context.tenantId),
        eq(resources.locationId, venueId),
        eq(resources.isActive, true),
      ),
    )
    .orderBy(asc(resources.sortOrder), asc(resources.name))

  const capabilities = await listCapabilitiesByResourceIds(
    context,
    rows.map((row) => row.id),
  )

  return rows.map((row) =>
    mapPublicResource(row, capabilities.get(row.id) ?? []),
  )
}

export async function getPublicVenueDetail(
  context: TenantContext,
  venueId: string,
): Promise<PublicVenueDetail | null> {
  const venue = await getPublicVenueById(context, venueId)

  if (!venue) {
    return null
  }

  const venueResources = await listPublicResourcesForVenue(context, venueId)

  return {
    ...venue,
    resources: venueResources,
  }
}
