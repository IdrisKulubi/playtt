import { AdminShell } from "@/components/admin/admin-shell"
import { AdminVenueSelector } from "@/components/admin/admin-catalog-forms"
import { adminShellUser } from "@/components/admin/admin-utils"
import { OperatorDevicesPanel } from "@/components/operator/operator-devices-panel"
import { HURLINGHAM_VENUE_ID } from "@/server/catalog/constants"
import { requireAdminPageAccess } from "@/server/admin/gate"
import { listDevicesForOperator } from "@/server/devices/devices-service"
import { isDeviceRegistryEnabledForTenant } from "@/server/devices/feature-policy"
import { listResources, listVenues } from "@/server/operator/service"
import { canPerformTenantAction } from "@/server/tenancy/permissions"
import { redirect } from "next/navigation"

export const dynamic = "force-dynamic"

type PageProps = {
  searchParams: Promise<{ venueId?: string }>
}

export default async function AdminDevicesPage({ searchParams }: PageProps) {
  const access = await requireAdminPageAccess()
  const params = await searchParams

  if (!(await isDeviceRegistryEnabledForTenant(access.context))) {
    redirect("/admin")
  }

  const venues = await listVenues(access.context)
  const selectedVenueId =
    params.venueId ??
    venues.find((venue) => venue.id === HURLINGHAM_VENUE_ID)?.id ??
    venues[0]?.id ??
    HURLINGHAM_VENUE_ID
  const resources = selectedVenueId
    ? await listResources(access.context, selectedVenueId)
    : []
  const devices = await listDevicesForOperator(access.context, selectedVenueId)
  const canManage = canPerformTenantAction(access.context.role, "venue.manage")

  return (
    <AdminShell
      title="Devices"
      subtitle="Enroll and assign hardware per venue."
      backHref="/admin"
      user={adminShellUser(access)}
    >
      <div className="space-y-6">
        <div className="admin-dashboard-card p-5">
          <AdminVenueSelector
            venues={venues}
            selectedVenueId={selectedVenueId}
            basePath="/admin/devices"
          />
        </div>
        <div className="admin-dashboard-card p-5">
          <OperatorDevicesPanel
            venues={venues}
            resources={resources}
            devices={devices}
            selectedVenueId={selectedVenueId}
            canManage={canManage}
          />
        </div>
      </div>
    </AdminShell>
  )
}
