import {
  attachAccessPointResource,
  createAccessPoint,
  detachAccessPointResource,
  listAccessPointResources,
  listAccessPoints,
  listRequiredAccessPointsByResourceIds,
  resolveRequiredAccessPoints,
  type AttachAccessPointResourceInput,
  type CatalogAccessPoint,
  type CatalogAccessPointResource,
  type CreateAccessPointInput,
  type DetachAccessPointResourceInput,
} from "@/server/catalog/access-points"
import { authorize } from "@/server/tenancy/authorize-context.mjs"
import { writeAuditLog } from "@/server/tenancy/audit-log.mjs"
import type { TenantContext } from "@/server/tenancy/types"

export {
  type CatalogAccessPoint,
  type CatalogAccessPointResource,
  type CreateAccessPointInput,
  type AttachAccessPointResourceInput,
  type DetachAccessPointResourceInput,
}

export async function listAccessPointsForCatalog(
  context: TenantContext,
  locationId?: string,
): Promise<CatalogAccessPoint[]> {
  authorize(context, "catalog.read")
  return listAccessPoints(context, locationId)
}

export async function listAccessPointResourcesForCatalog(
  context: TenantContext,
  accessPointId?: string,
): Promise<CatalogAccessPointResource[]> {
  authorize(context, "catalog.read")
  return listAccessPointResources(context, accessPointId)
}

export async function resolveRequiredAccessPointsForCatalog(
  context: TenantContext,
  resourceId: string,
): Promise<CatalogAccessPoint[]> {
  authorize(context, "catalog.read")
  return resolveRequiredAccessPoints(context, resourceId)
}

export async function listRequiredAccessPointsByResourceIdsForCatalog(
  context: TenantContext,
  resourceIds: string[],
): Promise<Record<string, CatalogAccessPoint[]>> {
  authorize(context, "catalog.read")
  return listRequiredAccessPointsByResourceIds(context, resourceIds)
}

export async function createAccessPointForCatalog(
  context: TenantContext,
  input: CreateAccessPointInput,
): Promise<CatalogAccessPoint> {
  authorize(context, "catalog.manage")
  const created = await createAccessPoint(context, input)

  await writeAuditLog(context, {
    action: "catalog.access_point.create",
    targetType: "access_point",
    targetId: created.id,
    metadata: {
      locationId: created.locationId,
      code: created.code,
      kind: created.kind,
    },
  })

  return created
}

export async function attachAccessPointResourceForCatalog(
  context: TenantContext,
  input: AttachAccessPointResourceInput,
): Promise<CatalogAccessPointResource> {
  authorize(context, "catalog.manage")
  const mapping = await attachAccessPointResource(context, input)

  await writeAuditLog(context, {
    action: "catalog.access_point.attach_resource",
    targetType: "access_point_resource",
    targetId: mapping.id,
    metadata: {
      accessPointId: mapping.accessPointId,
      resourceId: mapping.resourceId,
      sortOrder: mapping.sortOrder,
    },
  })

  return mapping
}

export async function detachAccessPointResourceForCatalog(
  context: TenantContext,
  input: DetachAccessPointResourceInput,
): Promise<boolean> {
  authorize(context, "catalog.manage")
  const detached = await detachAccessPointResource(context, input)

  if (detached) {
    await writeAuditLog(context, {
      action: "catalog.access_point.detach_resource",
      targetType: "access_point_resource",
      targetId: `${input.accessPointId}:${input.resourceId}`,
      metadata: {
        accessPointId: input.accessPointId,
        resourceId: input.resourceId,
      },
    })
  }

  return detached
}
