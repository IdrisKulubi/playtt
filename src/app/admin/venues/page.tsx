import { AdminShell } from "@/components/admin/admin-shell"
import { AdminVenuesTable } from "@/components/admin/admin-venues-table"
import { adminShellUser } from "@/components/admin/admin-utils"
import { requireAdminPageAccess } from "@/server/admin/gate"
import { getCatalogOverview } from "@/server/operator/service"

export const dynamic = "force-dynamic"

export default async function AdminVenuesPage() {
  const access = await requireAdminPageAccess()
  const overview = await getCatalogOverview(access.context)
  const resourceCounts = Object.fromEntries(
    overview.venues.map(({ venue, resourceCount }) => [venue.id, resourceCount]),
  )

  return (
    <AdminShell
      title="Venues"
      subtitle="Manage PlayTT locations, tables, and devices."
      backHref="/admin"
      user={adminShellUser(access)}
    >
      <AdminVenuesTable
        venues={overview.venues.map(({ venue }) => venue)}
        resourceCounts={resourceCounts}
        canManageCatalog={access.canManageCatalog}
      />
    </AdminShell>
  )
}
