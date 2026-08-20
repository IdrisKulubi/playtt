import { randomUUID } from "node:crypto"

import { and, eq } from "drizzle-orm"

import db from "@/db/drizzle"
import { brands, locations, resourceCapabilities, resources, zones } from "@/db/schema"
import type { resourceTypeEnum } from "@/db/schema"
import { slugify } from "@/server/catalog/slugify"
import { TenancyError } from "@/server/tenancy/errors"
import type { TenantContext } from "@/server/tenancy/types"

export type ResourceKind = (typeof resourceTypeEnum.enumValues)[number]

export interface CreateVenueInput {
  name: string
  slug?: string
  address: string
  timezone?: string
  notes?: string | null
}

export interface UpdateVenueInput {
  venueId: string
  name?: string
  slug?: string
  address?: string
  timezone?: string
  notes?: string | null
  isActive?: boolean
}

export interface CreateZoneInput {
  locationId: string
  name: string
  slug?: string
  sortOrder?: number
}

export interface UpdateZoneInput {
  zoneId: string
  name?: string
  slug?: string
  sortOrder?: number
  isActive?: boolean
}

export interface CreateResourceInput {
  locationId: string
  zoneId?: string | null
  resourceTypeId?: string | null
  name: string
  slug?: string
  code?: string | null
  type?: ResourceKind
  ruleset?: string | null
  capacity?: number
  sortOrder?: number
}

export interface UpdateResourceInput {
  resourceId: string
  zoneId?: string | null
  resourceTypeId?: string | null
  name?: string
  slug?: string
  code?: string | null
  type?: ResourceKind
  ruleset?: string | null
  capacity?: number
  sortOrder?: number
  isActive?: boolean
}

async function getDefaultBrandId(tenantId: string): Promise<string> {
  const [brand] = await db
    .select({ id: brands.id })
    .from(brands)
    .where(and(eq(brands.tenantId, tenantId), eq(brands.isDefault, true)))
    .limit(1)

  if (!brand) {
    throw new TenancyError(
      "FORBIDDEN_ACTION",
      "No default brand configured for this tenant.",
    )
  }

  return brand.id
}

async function assertVenueInTenant(context: TenantContext, venueId: string) {
  const [venue] = await db
    .select({ id: locations.id })
    .from(locations)
    .where(
      and(eq(locations.id, venueId), eq(locations.tenantId, context.tenantId)),
    )
    .limit(1)

  if (!venue) {
    throw new TenancyError(
      "FORBIDDEN_ACTION",
      "Venue was not found for this tenant.",
    )
  }
}

export async function createVenue(context: TenantContext, input: CreateVenueInput) {
  const brandId = await getDefaultBrandId(context.tenantId)
  const slug = input.slug?.trim() || slugify(input.name)

  const [created] = await db
    .insert(locations)
    .values({
      id: randomUUID(),
      tenantId: context.tenantId,
      brandId,
      name: input.name.trim(),
      slug,
      address: input.address.trim(),
      timezone: input.timezone?.trim() || "Africa/Nairobi",
      notes: input.notes ?? null,
      isActive: true,
    })
    .returning()

  return created
}

export async function updateVenue(context: TenantContext, input: UpdateVenueInput) {
  await assertVenueInTenant(context, input.venueId)

  const patch: Partial<typeof locations.$inferInsert> = {}

  if (input.name !== undefined) patch.name = input.name.trim()
  if (input.slug !== undefined) patch.slug = input.slug.trim()
  if (input.address !== undefined) patch.address = input.address.trim()
  if (input.timezone !== undefined) patch.timezone = input.timezone.trim()
  if (input.notes !== undefined) patch.notes = input.notes
  if (input.isActive !== undefined) {
    patch.isActive = input.isActive
    patch.archivedAt = input.isActive ? null : new Date()
  }

  const [updated] = await db
    .update(locations)
    .set(patch)
    .where(
      and(
        eq(locations.id, input.venueId),
        eq(locations.tenantId, context.tenantId),
      ),
    )
    .returning()

  if (!updated) {
    throw new TenancyError("FORBIDDEN_ACTION", "Venue update failed.")
  }

  return updated
}

export async function createZone(context: TenantContext, input: CreateZoneInput) {
  await assertVenueInTenant(context, input.locationId)
  const slug = input.slug?.trim() || slugify(input.name)

  const [created] = await db
    .insert(zones)
    .values({
      id: randomUUID(),
      tenantId: context.tenantId,
      locationId: input.locationId,
      name: input.name.trim(),
      slug,
      sortOrder: input.sortOrder ?? 0,
      isActive: true,
    })
    .returning()

  return created
}

export async function updateZone(context: TenantContext, input: UpdateZoneInput) {
  const patch: Partial<typeof zones.$inferInsert> = {}

  if (input.name !== undefined) patch.name = input.name.trim()
  if (input.slug !== undefined) patch.slug = input.slug.trim()
  if (input.sortOrder !== undefined) patch.sortOrder = input.sortOrder
  if (input.isActive !== undefined) patch.isActive = input.isActive

  const [updated] = await db
    .update(zones)
    .set(patch)
    .where(
      and(eq(zones.id, input.zoneId), eq(zones.tenantId, context.tenantId)),
    )
    .returning()

  if (!updated) {
    throw new TenancyError("FORBIDDEN_ACTION", "Zone update failed.")
  }

  return updated
}

export async function createResource(
  context: TenantContext,
  input: CreateResourceInput,
) {
  await assertVenueInTenant(context, input.locationId)
  const slug = input.slug?.trim() || slugify(input.name)

  const [created] = await db
    .insert(resources)
    .values({
      tenantId: context.tenantId,
      locationId: input.locationId,
      zoneId: input.zoneId ?? null,
      resourceTypeId: input.resourceTypeId ?? null,
      name: input.name.trim(),
      slug,
      code: input.code ?? null,
      type: input.type ?? "pod",
      ruleset: input.ruleset ?? null,
      capacity: input.capacity ?? 2,
      sortOrder: input.sortOrder ?? 0,
      isActive: true,
    })
    .returning()

  return created
}

export async function updateResource(
  context: TenantContext,
  input: UpdateResourceInput,
) {
  const patch: Partial<typeof resources.$inferInsert> = {}

  if (input.zoneId !== undefined) patch.zoneId = input.zoneId
  if (input.resourceTypeId !== undefined) patch.resourceTypeId = input.resourceTypeId
  if (input.name !== undefined) patch.name = input.name.trim()
  if (input.slug !== undefined) patch.slug = input.slug.trim()
  if (input.code !== undefined) patch.code = input.code
  if (input.type !== undefined) patch.type = input.type
  if (input.ruleset !== undefined) patch.ruleset = input.ruleset
  if (input.capacity !== undefined) patch.capacity = input.capacity
  if (input.sortOrder !== undefined) patch.sortOrder = input.sortOrder
  if (input.isActive !== undefined) patch.isActive = input.isActive

  const [updated] = await db
    .update(resources)
    .set(patch)
    .where(
      and(
        eq(resources.id, input.resourceId),
        eq(resources.tenantId, context.tenantId),
      ),
    )
    .returning()

  if (!updated) {
    throw new TenancyError("FORBIDDEN_ACTION", "Resource update failed.")
  }

  return updated
}

export async function addResourceCapability(
  context: TenantContext,
  input: { resourceId: string; code: string; config?: Record<string, unknown> | null },
) {
  const [created] = await db
    .insert(resourceCapabilities)
    .values({
      tenantId: context.tenantId,
      resourceId: input.resourceId,
      code: input.code.trim(),
      config: input.config ?? null,
    })
    .returning()

  return created
}
