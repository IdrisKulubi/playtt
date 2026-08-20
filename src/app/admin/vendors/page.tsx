import { AdminVendorsPanel } from "@/components/admin/admin-operations-panels"
import { AdminShell } from "@/components/admin/admin-shell"
import { adminShellUser } from "@/components/admin/admin-utils"
import {
  listVenueIntegrationsForAdmin,
  listVendorsForAdmin,
} from "@/server/admin/vendors-service"
import { requireAdminPageAccess } from "@/server/admin/gate"
import { listVenues } from "@/server/operator/service"

export const dynamic = "force-dynamic"

export default async function AdminVendorsPage() {
  const access = await requireAdminPageAccess()
  const [vendors, integrations, venues] = await Promise.all([
    listVendorsForAdmin(access.context),
    listVenueIntegrationsForAdmin(access.context),
    listVenues(access.context),
  ])

  return (
    <AdminShell
      title="Vendors"
      subtitle="Hardware and integration vendors attached to venues."
      backHref="/admin"
      user={adminShellUser(access)}
    >
      <AdminVendorsPanel
        vendors={vendors}
        integrations={integrations}
        venues={venues}
        canManage={access.canManageCatalog}
      />
    </AdminShell>
  )
}
