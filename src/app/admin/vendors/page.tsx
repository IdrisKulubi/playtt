import { AdminVendorsPanel } from "@/components/admin/admin-operations-panels"
import { AdminShell } from "@/components/admin/admin-shell"
import {
  listVenueIntegrationsForAdmin,
  listVendorsForAdmin,
} from "@/server/admin/vendors-service"
import { requireAdminPageAccess } from "@/server/admin/gate"
import { listVenues } from "@/server/operator/service"

export const dynamic = "force-dynamic"

export default async function AdminVendorsPage() {
  const { context, canManageCatalog } = await requireAdminPageAccess()
  const [vendors, integrations, venues] = await Promise.all([
    listVendorsForAdmin(context),
    listVenueIntegrationsForAdmin(context),
    listVenues(context),
  ])

  return (
    <AdminShell title="Vendors" eyebrow="Integrations" backHref="/admin">
      <AdminVendorsPanel
        vendors={vendors}
        integrations={integrations}
        venues={venues}
        canManage={canManageCatalog}
      />
    </AdminShell>
  )
}
