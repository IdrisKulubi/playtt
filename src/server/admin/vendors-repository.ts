import { and, eq } from "drizzle-orm"

import db from "@/db/drizzle"
import {
  integrationVendors,
  locations,
  venueIntegrations,
} from "@/db/schema"
import type {
  integrationVendorKindEnum,
  integrationVendorStatusEnum,
  venueIntegrationStatusEnum,
} from "@/db/schema"
import { TenancyError } from "@/server/tenancy/errors"
import type { TenantContext } from "@/server/tenancy/types"

export type IntegrationVendorKind =
  (typeof integrationVendorKindEnum.enumValues)[number]
export type IntegrationVendorStatus =
  (typeof integrationVendorStatusEnum.enumValues)[number]
export type VenueIntegrationStatus =
  (typeof venueIntegrationStatusEnum.enumValues)[number]

export interface AdminIntegrationVendor {
  id: string
  tenantId: string
  name: string
  kind: IntegrationVendorKind
  status: IntegrationVendorStatus
  notes: string | null
  createdAt: string
  updatedAt: string
}

export interface AdminVenueIntegration {
  id: string
  tenantId: string
  locationId: string
  locationName: string
  vendorId: string
  vendorName: string
  vendorKind: IntegrationVendorKind
  status: VenueIntegrationStatus
  config: Record<string, unknown> | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

function mapVendor(row: typeof integrationVendors.$inferSelect): AdminIntegrationVendor {
  return {
    id: row.id,
    tenantId: row.tenantId,
    name: row.name,
    kind: row.kind,
    status: row.status,
    notes: row.notes ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export async function listIntegrationVendors(
  context: TenantContext,
): Promise<AdminIntegrationVendor[]> {
  const rows = await db
    .select()
    .from(integrationVendors)
    .where(eq(integrationVendors.tenantId, context.tenantId))
    .orderBy(integrationVendors.name)

  return rows.map(mapVendor)
}

export async function createIntegrationVendor(
  context: TenantContext,
  input: {
    name: string
    kind: IntegrationVendorKind
    notes?: string | null
  },
) {
  const [created] = await db
    .insert(integrationVendors)
    .values({
      tenantId: context.tenantId,
      name: input.name.trim(),
      kind: input.kind,
      status: "active",
      notes: input.notes ?? null,
    })
    .returning()

  return mapVendor(created)
}

export async function listVenueIntegrations(
  context: TenantContext,
  locationId?: string,
): Promise<AdminVenueIntegration[]> {
  const conditions = [eq(venueIntegrations.tenantId, context.tenantId)]

  if (locationId) {
    conditions.push(eq(venueIntegrations.locationId, locationId))
  }

  const rows = await db
    .select({
      integration: venueIntegrations,
      locationName: locations.name,
      vendorName: integrationVendors.name,
      vendorKind: integrationVendors.kind,
    })
    .from(venueIntegrations)
    .innerJoin(locations, eq(venueIntegrations.locationId, locations.id))
    .innerJoin(
      integrationVendors,
      eq(venueIntegrations.vendorId, integrationVendors.id),
    )
    .where(and(...conditions))
    .orderBy(locations.name, integrationVendors.name)

  return rows.map((row) => ({
    id: row.integration.id,
    tenantId: row.integration.tenantId,
    locationId: row.integration.locationId,
    locationName: row.locationName,
    vendorId: row.integration.vendorId,
    vendorName: row.vendorName,
    vendorKind: row.vendorKind,
    status: row.integration.status,
    config: row.integration.config ?? null,
    notes: row.integration.notes ?? null,
    createdAt: row.integration.createdAt.toISOString(),
    updatedAt: row.integration.updatedAt.toISOString(),
  }))
}

export async function attachVenueIntegration(
  context: TenantContext,
  input: {
    locationId: string
    vendorId: string
    status?: VenueIntegrationStatus
    config?: Record<string, unknown> | null
    notes?: string | null
  },
) {
  const [venue] = await db
    .select({ id: locations.id })
    .from(locations)
    .where(
      and(
        eq(locations.id, input.locationId),
        eq(locations.tenantId, context.tenantId),
      ),
    )
    .limit(1)

  if (!venue) {
    throw new TenancyError("FORBIDDEN_ACTION", "Venue not found.")
  }

  const [vendor] = await db
    .select({ id: integrationVendors.id })
    .from(integrationVendors)
    .where(
      and(
        eq(integrationVendors.id, input.vendorId),
        eq(integrationVendors.tenantId, context.tenantId),
      ),
    )
    .limit(1)

  if (!vendor) {
    throw new TenancyError("FORBIDDEN_ACTION", "Vendor not found.")
  }

  const [created] = await db
    .insert(venueIntegrations)
    .values({
      tenantId: context.tenantId,
      locationId: input.locationId,
      vendorId: input.vendorId,
      status: input.status ?? "pending",
      config: input.config ?? null,
      notes: input.notes ?? null,
    })
    .returning()

  const integrations = await listVenueIntegrations(context, input.locationId)
  return integrations.find((row) => row.id === created.id) ?? null
}
