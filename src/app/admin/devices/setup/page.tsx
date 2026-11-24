import { AdminControllerSetup } from "@/components/admin/admin-controller-setup"
import { AdminShell } from "@/components/admin/admin-shell"
import { adminShellUser } from "@/components/admin/admin-utils"
import { requireAdminPageAccess } from "@/server/admin/gate"
import { isDeviceRegistryEnabledForTenant } from "@/server/devices/feature-policy"
import { listResources, listVenues } from "@/server/operator/service"
import { canPerformTenantAction } from "@/server/tenancy/permissions"
import { redirect } from "next/navigation"

export const dynamic = "force-dynamic"

export default async function AdminControllerSetupPage() {
  const access = await requireAdminPageAccess()

  if (!(await isDeviceRegistryEnabledForTenant(access.context))) {
    redirect("/admin")
  }

  const venues = await listVenues(access.context)
  const resources = (await Promise.all(venues.map((venue) => listResources(access.context, venue.id)))).flat()
  const canManage = canPerformTenantAction(access.context.role, "venue.manage")

  return (
    <AdminShell
      title="Set up controller"
      subtitle="Plug a score controller into this computer to install, connect and register it."
      backHref="/admin/devices"
      user={adminShellUser(access)}
      searchable={false}
    >
      <AdminControllerSetup
        venues={venues.map((venue) => ({ id: venue.id, name: venue.name }))}
        tables={resources.map((resource) => ({ id: resource.id, name: resource.name, venueId: resource.locationId }))}
        canManage={canManage}
      />
    </AdminShell>
  )
}
