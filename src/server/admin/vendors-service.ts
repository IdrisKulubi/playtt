import {
  attachVenueIntegration,
  createIntegrationVendor,
  listIntegrationVendors,
  listVenueIntegrations,
  type AdminIntegrationVendor,
  type AdminVenueIntegration,
  type IntegrationVendorKind,
  type VenueIntegrationStatus,
} from "@/server/admin/vendors-repository"
import { authorize } from "@/server/tenancy/authorize-context.mjs"
import { writeAuditLog } from "@/server/tenancy/audit-log.mjs"
import type { TenantContext } from "@/server/tenancy/types"

export type { AdminIntegrationVendor, AdminVenueIntegration, IntegrationVendorKind }

export async function listVendorsForAdmin(context: TenantContext) {
  authorize(context, "catalog.read")
  return listIntegrationVendors(context)
}

export async function listVenueIntegrationsForAdmin(
  context: TenantContext,
  locationId?: string,
) {
  authorize(context, "catalog.read")
  return listVenueIntegrations(context, locationId)
}

export async function createVendorForAdmin(
  context: TenantContext,
  input: { name: string; kind: IntegrationVendorKind; notes?: string | null },
) {
  authorize(context, "catalog.manage")
  const created = await createIntegrationVendor(context, input)

  await writeAuditLog(context, {
    action: "integration.vendor.create",
    targetType: "integration_vendor",
    targetId: created.id,
    metadata: input,
  })

  return created
}

export async function attachVenueIntegrationForAdmin(
  context: TenantContext,
  input: {
    locationId: string
    vendorId: string
    status?: VenueIntegrationStatus
    config?: Record<string, unknown> | null
    notes?: string | null
  },
) {
  authorize(context, "catalog.manage")
  const created = await attachVenueIntegration(context, input)

  await writeAuditLog(context, {
    action: "integration.venue.attach",
    targetType: "venue_integration",
    targetId: created?.id ?? null,
    metadata: input,
  })

  return created
}
