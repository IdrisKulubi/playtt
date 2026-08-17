import { and, count, eq, sql } from "drizzle-orm"

import db from "@/db/drizzle"
import {
  featureFlags,
  locations,
  resourceCapabilities,
  resourceTypes,
  resources,
  tenantMemberships,
  tenants,
  user,
  zones,
} from "@/db/schema"
import type {
  OperatorCapability,
  OperatorCatalogOverview,
  OperatorFeatureFlag,
  OperatorMembership,
  OperatorResource,
  OperatorResourceType,
  OperatorTenantSummary,
  OperatorVenue,
  OperatorZone,
} from "@/server/operator/types"
import type { TenantContext } from "@/server/tenancy/types"

function toIsoString(value: Date | null | undefined) {
  return value ? value.toISOString() : null
}

function mapTenant(row: typeof tenants.$inferSelect): OperatorTenantSummary {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    status: row.status,
    settings: row.settings ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

function mapVenue(row: typeof locations.$inferSelect): OperatorVenue {
  return {
    id: row.id,
    tenantId: row.tenantId,
    brandId: row.brandId ?? null,
    name: row.name,
    slug: row.slug,
    address: row.address,
    timezone: row.timezone,
    isActive: row.isActive,
    settings: row.settings ?? null,
    archivedAt: toIsoString(row.archivedAt),
    notes: row.notes ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

function mapZone(row: typeof zones.$inferSelect): OperatorZone {
  return {
    id: row.id,
    tenantId: row.tenantId,
    locationId: row.locationId,
    name: row.name,
    slug: row.slug,
    sortOrder: row.sortOrder,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

function mapResource(row: typeof resources.$inferSelect): OperatorResource {
  return {
    id: row.id,
    tenantId: row.tenantId,
    locationId: row.locationId,
    zoneId: row.zoneId ?? null,
    resourceTypeId: row.resourceTypeId ?? null,
    name: row.name,
    slug: row.slug,
    code: row.code ?? null,
    type: row.type,
    ruleset: row.ruleset ?? null,
    capacity: row.capacity,
    sortOrder: row.sortOrder,
    isActive: row.isActive,
    metadata: row.metadata ?? null,
    configuration: row.configuration ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

function mapResourceType(
  row: typeof resourceTypes.$inferSelect,
): OperatorResourceType {
  return {
    id: row.id,
    tenantId: row.tenantId,
    code: row.code,
    name: row.name,
    description: row.description ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

function mapCapability(
  row: typeof resourceCapabilities.$inferSelect,
): OperatorCapability {
  return {
    id: row.id,
    tenantId: row.tenantId,
    resourceId: row.resourceId,
    code: row.code,
    config: row.config ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

function mapFeatureFlag(row: typeof featureFlags.$inferSelect): OperatorFeatureFlag {
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

export async function getTenantSummary(
  context: TenantContext,
): Promise<OperatorTenantSummary> {
  const [row] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.id, context.tenantId))
    .limit(1)

  if (!row) {
    throw new Error("Tenant not found.")
  }

  return mapTenant(row)
}

export async function listVenues(context: TenantContext): Promise<OperatorVenue[]> {
  const rows = await db
    .select()
    .from(locations)
    .where(eq(locations.tenantId, context.tenantId))
    .orderBy(locations.name)

  return rows.map(mapVenue)
}

export async function listZones(
  context: TenantContext,
  locationId?: string,
): Promise<OperatorZone[]> {
  const conditions = [eq(zones.tenantId, context.tenantId)]

  if (locationId) {
    conditions.push(eq(zones.locationId, locationId))
  }

  const rows = await db
    .select()
    .from(zones)
    .where(and(...conditions))
    .orderBy(zones.sortOrder, zones.name)

  return rows.map(mapZone)
}

export async function listResources(
  context: TenantContext,
  locationId?: string,
): Promise<OperatorResource[]> {
  const conditions = [eq(resources.tenantId, context.tenantId)]

  if (locationId) {
    conditions.push(eq(resources.locationId, locationId))
  }

  const rows = await db
    .select()
    .from(resources)
    .where(and(...conditions))
    .orderBy(resources.sortOrder, resources.name)

  return rows.map(mapResource)
}

export async function listResourceTypes(
  context: TenantContext,
): Promise<OperatorResourceType[]> {
  const rows = await db
    .select()
    .from(resourceTypes)
    .where(eq(resourceTypes.tenantId, context.tenantId))
    .orderBy(resourceTypes.name)

  return rows.map(mapResourceType)
}

export async function listCapabilities(
  context: TenantContext,
  resourceId?: string,
): Promise<OperatorCapability[]> {
  const conditions = [eq(resourceCapabilities.tenantId, context.tenantId)]

  if (resourceId) {
    conditions.push(eq(resourceCapabilities.resourceId, resourceId))
  }

  const rows = await db
    .select()
    .from(resourceCapabilities)
    .where(and(...conditions))
    .orderBy(resourceCapabilities.code)

  return rows.map(mapCapability)
}

export async function listMemberships(
  context: TenantContext,
): Promise<OperatorMembership[]> {
  const rows = await db
    .select({
      membership: tenantMemberships,
      email: user.email,
      name: user.name,
    })
    .from(tenantMemberships)
    .innerJoin(user, eq(tenantMemberships.userId, user.id))
    .where(eq(tenantMemberships.tenantId, context.tenantId))
    .orderBy(user.name, user.email)

  return rows.map((row) => ({
    id: row.membership.id,
    tenantId: row.membership.tenantId,
    userId: row.membership.userId,
    role: row.membership.role,
    status: row.membership.status,
    email: row.email,
    name: row.name,
    createdAt: row.membership.createdAt.toISOString(),
    updatedAt: row.membership.updatedAt.toISOString(),
  }))
}

export async function listFeatureFlags(
  context: TenantContext,
): Promise<OperatorFeatureFlag[]> {
  const rows = await db
    .select()
    .from(featureFlags)
    .where(eq(featureFlags.tenantId, context.tenantId))
    .orderBy(featureFlags.key)

  return rows.map(mapFeatureFlag)
}

export async function getCatalogOverview(
  context: TenantContext,
): Promise<OperatorCatalogOverview> {
  const tenant = await getTenantSummary(context)
  const venueRows = await listVenues(context)

  const [resourceTypeCountRow] = await db
    .select({ value: count() })
    .from(resourceTypes)
    .where(eq(resourceTypes.tenantId, context.tenantId))

  const [membershipCountRow] = await db
    .select({ value: count() })
    .from(tenantMemberships)
    .where(eq(tenantMemberships.tenantId, context.tenantId))

  const zoneCountRows = await db
    .select({
      locationId: zones.locationId,
      value: count(),
    })
    .from(zones)
    .where(eq(zones.tenantId, context.tenantId))
    .groupBy(zones.locationId)

  const resourceCountRows = await db
    .select({
      locationId: resources.locationId,
      value: count(),
    })
    .from(resources)
    .where(eq(resources.tenantId, context.tenantId))
    .groupBy(resources.locationId)

  const capabilityCountRows = await db
    .select({
      locationId: resources.locationId,
      value: sql<number>`count(${resourceCapabilities.id})::int`,
    })
    .from(resourceCapabilities)
    .innerJoin(resources, eq(resourceCapabilities.resourceId, resources.id))
    .where(eq(resourceCapabilities.tenantId, context.tenantId))
    .groupBy(resources.locationId)

  const zoneCounts = new Map(
    zoneCountRows.map((row) => [row.locationId, Number(row.value)]),
  )
  const resourceCounts = new Map(
    resourceCountRows.map((row) => [row.locationId, Number(row.value)]),
  )
  const capabilityCounts = new Map(
    capabilityCountRows.map((row) => [row.locationId, Number(row.value)]),
  )

  return {
    tenant,
    resourceTypeCount: Number(resourceTypeCountRow?.value ?? 0),
    membershipCount: Number(membershipCountRow?.value ?? 0),
    venues: venueRows.map((venue) => ({
      venue,
      zoneCount: zoneCounts.get(venue.id) ?? 0,
      resourceCount: resourceCounts.get(venue.id) ?? 0,
      capabilityCount: capabilityCounts.get(venue.id) ?? 0,
    })),
  }
}
