import {
  addResourceCapability,
  createResource,
  createVenue,
  createZone,
  updateResource,
  updateVenue,
  updateZone,
  type CreateResourceInput,
  type CreateVenueInput,
  type CreateZoneInput,
  type UpdateResourceInput,
  type UpdateVenueInput,
  type UpdateZoneInput,
} from "@/server/catalog/venues"
import { authorize } from "@/server/tenancy/authorize-context.mjs"
import { writeAuditLog } from "@/server/tenancy/audit-log.mjs"
import type { TenantContext } from "@/server/tenancy/types"

export async function createVenueForCatalog(
  context: TenantContext,
  input: CreateVenueInput,
) {
  authorize(context, "catalog.manage")
  const created = await createVenue(context, input)

  await writeAuditLog(context, {
    action: "catalog.venue.create",
    targetType: "location",
    targetId: created.id,
    metadata: { name: created.name, slug: created.slug },
  })

  return created
}

export async function updateVenueForCatalog(
  context: TenantContext,
  input: UpdateVenueInput,
) {
  authorize(context, "catalog.manage")
  const updated = await updateVenue(context, input)

  await writeAuditLog(context, {
    action: "catalog.venue.update",
    targetType: "location",
    targetId: updated.id,
    metadata: input,
  })

  return updated
}

export async function createZoneForCatalog(
  context: TenantContext,
  input: CreateZoneInput,
) {
  authorize(context, "catalog.manage")
  const created = await createZone(context, input)

  await writeAuditLog(context, {
    action: "catalog.zone.create",
    targetType: "zone",
    targetId: created.id,
    metadata: { locationId: created.locationId, name: created.name },
  })

  return created
}

export async function updateZoneForCatalog(
  context: TenantContext,
  input: UpdateZoneInput,
) {
  authorize(context, "catalog.manage")
  const updated = await updateZone(context, input)

  await writeAuditLog(context, {
    action: "catalog.zone.update",
    targetType: "zone",
    targetId: updated.id,
    metadata: input,
  })

  return updated
}

export async function createResourceForCatalog(
  context: TenantContext,
  input: CreateResourceInput,
) {
  authorize(context, "catalog.manage")
  const created = await createResource(context, input)

  await writeAuditLog(context, {
    action: "catalog.resource.create",
    targetType: "resource",
    targetId: created.id,
    metadata: { locationId: created.locationId, name: created.name },
  })

  return created
}

export async function updateResourceForCatalog(
  context: TenantContext,
  input: UpdateResourceInput,
) {
  authorize(context, "catalog.manage")
  const updated = await updateResource(context, input)

  await writeAuditLog(context, {
    action: "catalog.resource.update",
    targetType: "resource",
    targetId: updated.id,
    metadata: input,
  })

  return updated
}

export async function addResourceCapabilityForCatalog(
  context: TenantContext,
  input: { resourceId: string; code: string; config?: Record<string, unknown> | null },
) {
  authorize(context, "catalog.manage")
  const created = await addResourceCapability(context, input)

  await writeAuditLog(context, {
    action: "catalog.capability.create",
    targetType: "resource_capability",
    targetId: created.id,
    metadata: { resourceId: input.resourceId, code: input.code },
  })

  return created
}
