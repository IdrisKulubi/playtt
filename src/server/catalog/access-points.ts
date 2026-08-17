import { randomUUID } from "node:crypto"

import { and, asc, eq } from "drizzle-orm"

import db from "@/db/drizzle"
import {
  accessPointResources,
  accessPoints,
  resources,
} from "@/db/schema"
import type { accessPointKindEnum } from "@/db/schema"
import { TenancyError } from "@/server/tenancy/errors"
import type { TenantContext } from "@/server/tenancy/types"

export type AccessPointKind =
  (typeof accessPointKindEnum.enumValues)[number]

export interface CatalogAccessPoint {
  id: string
  tenantId: string
  locationId: string
  zoneId: string | null
  code: string
  name: string
  kind: AccessPointKind
  sortOrder: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface CatalogAccessPointResource {
  id: string
  tenantId: string
  accessPointId: string
  resourceId: string
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export interface CreateAccessPointInput {
  locationId: string
  zoneId?: string | null
  code: string
  name: string
  kind: AccessPointKind
  sortOrder?: number
  isActive?: boolean
}

export interface AttachAccessPointResourceInput {
  accessPointId: string
  resourceId: string
  sortOrder?: number
}

export interface DetachAccessPointResourceInput {
  accessPointId: string
  resourceId: string
}

function mapAccessPoint(row: typeof accessPoints.$inferSelect): CatalogAccessPoint {
  return {
    id: row.id,
    tenantId: row.tenantId,
    locationId: row.locationId,
    zoneId: row.zoneId ?? null,
    code: row.code,
    name: row.name,
    kind: row.kind,
    sortOrder: row.sortOrder,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

function mapAccessPointResource(
  row: typeof accessPointResources.$inferSelect,
): CatalogAccessPointResource {
  return {
    id: row.id,
    tenantId: row.tenantId,
    accessPointId: row.accessPointId,
    resourceId: row.resourceId,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export async function listAccessPoints(
  context: TenantContext,
  locationId?: string,
): Promise<CatalogAccessPoint[]> {
  const conditions = [eq(accessPoints.tenantId, context.tenantId)]

  if (locationId) {
    conditions.push(eq(accessPoints.locationId, locationId))
  }

  const rows = await db
    .select()
    .from(accessPoints)
    .where(and(...conditions))
    .orderBy(asc(accessPoints.sortOrder), asc(accessPoints.name))

  return rows.map(mapAccessPoint)
}

export async function listAccessPointResources(
  context: TenantContext,
  accessPointId?: string,
): Promise<CatalogAccessPointResource[]> {
  const conditions = [eq(accessPointResources.tenantId, context.tenantId)]

  if (accessPointId) {
    conditions.push(eq(accessPointResources.accessPointId, accessPointId))
  }

  const rows = await db
    .select()
    .from(accessPointResources)
    .where(and(...conditions))
    .orderBy(asc(accessPointResources.sortOrder))

  return rows.map(mapAccessPointResource)
}

export async function resolveRequiredAccessPoints(
  context: TenantContext,
  resourceId: string,
): Promise<CatalogAccessPoint[]> {
  const [resource] = await db
    .select({ id: resources.id })
    .from(resources)
    .where(
      and(
        eq(resources.tenantId, context.tenantId),
        eq(resources.id, resourceId),
      ),
    )
    .limit(1)

  if (!resource) {
    return []
  }

  const rows = await db
    .select({
      accessPoint: accessPoints,
      mappingSortOrder: accessPointResources.sortOrder,
    })
    .from(accessPointResources)
    .innerJoin(
      accessPoints,
      and(
        eq(accessPointResources.accessPointId, accessPoints.id),
        eq(accessPointResources.tenantId, accessPoints.tenantId),
      ),
    )
    .where(
      and(
        eq(accessPointResources.tenantId, context.tenantId),
        eq(accessPointResources.resourceId, resourceId),
        eq(accessPoints.isActive, true),
      ),
    )
    .orderBy(
      asc(accessPoints.sortOrder),
      asc(accessPointResources.sortOrder),
      asc(accessPoints.name),
    )

  return rows.map((row) => mapAccessPoint(row.accessPoint))
}

async function getAccessPointForTenant(
  context: TenantContext,
  accessPointId: string,
) {
  const [row] = await db
    .select()
    .from(accessPoints)
    .where(
      and(
        eq(accessPoints.tenantId, context.tenantId),
        eq(accessPoints.id, accessPointId),
      ),
    )
    .limit(1)

  return row ?? null
}

async function getResourceForTenant(context: TenantContext, resourceId: string) {
  const [row] = await db
    .select()
    .from(resources)
    .where(
      and(
        eq(resources.tenantId, context.tenantId),
        eq(resources.id, resourceId),
      ),
    )
    .limit(1)

  return row ?? null
}

function assertSameVenueMapping(input: {
  accessPointLocationId: string
  resourceLocationId: string
}) {
  if (input.accessPointLocationId !== input.resourceLocationId) {
    throw new TenancyError(
      "FORBIDDEN_ACTION",
      "Access points and resources must belong to the same venue.",
    )
  }
}

export async function createAccessPoint(
  context: TenantContext,
  input: CreateAccessPointInput,
): Promise<CatalogAccessPoint> {
  const [created] = await db
    .insert(accessPoints)
    .values({
      id: randomUUID(),
      tenantId: context.tenantId,
      locationId: input.locationId,
      zoneId: input.zoneId ?? null,
      code: input.code,
      name: input.name,
      kind: input.kind,
      sortOrder: input.sortOrder ?? 0,
      isActive: input.isActive ?? true,
    })
    .returning()

  return mapAccessPoint(created)
}

export async function attachAccessPointResource(
  context: TenantContext,
  input: AttachAccessPointResourceInput,
): Promise<CatalogAccessPointResource> {
  const accessPoint = await getAccessPointForTenant(context, input.accessPointId)

  if (!accessPoint) {
    throw new TenancyError(
      "FORBIDDEN_ACTION",
      "Access point was not found for this tenant.",
    )
  }

  const resource = await getResourceForTenant(context, input.resourceId)

  if (!resource) {
    throw new TenancyError(
      "FORBIDDEN_ACTION",
      "Resource was not found for this tenant.",
    )
  }

  assertSameVenueMapping({
    accessPointLocationId: accessPoint.locationId,
    resourceLocationId: resource.locationId,
  })

  const [created] = await db
    .insert(accessPointResources)
    .values({
      tenantId: context.tenantId,
      accessPointId: input.accessPointId,
      resourceId: input.resourceId,
      sortOrder: input.sortOrder ?? 0,
    })
    .returning()

  return mapAccessPointResource(created)
}

export async function detachAccessPointResource(
  context: TenantContext,
  input: DetachAccessPointResourceInput,
): Promise<boolean> {
  const deleted = await db
    .delete(accessPointResources)
    .where(
      and(
        eq(accessPointResources.tenantId, context.tenantId),
        eq(accessPointResources.accessPointId, input.accessPointId),
        eq(accessPointResources.resourceId, input.resourceId),
      ),
    )
    .returning({ id: accessPointResources.id })

  return deleted.length > 0
}

export async function listRequiredAccessPointsByResourceIds(
  context: TenantContext,
  resourceIds: string[],
): Promise<Record<string, CatalogAccessPoint[]>> {
  const result: Record<string, CatalogAccessPoint[]> = {}

  for (const resourceId of resourceIds) {
    result[resourceId] = await resolveRequiredAccessPoints(context, resourceId)
  }

  return result
}
