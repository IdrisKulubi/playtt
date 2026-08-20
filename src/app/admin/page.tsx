import Link from "next/link"

import { AdminOverviewMetricsCards, AdminShell } from "@/components/admin/admin-shell"
import { AdminSetupBanner } from "@/components/admin/admin-setup-banner"
import { OperatorOverviewCards, OperatorVenueList } from "@/components/operator/operator-overview"
import { Button } from "@/components/ui/button"
import { getOverviewForAdmin } from "@/server/admin/analytics-service"
import { requireAdminPageAccess } from "@/server/admin/gate"
import { getCatalogOverview } from "@/server/operator/service"

export const dynamic = "force-dynamic"

export default async function AdminOverviewPage() {
  const { context, isOwner, canManageCatalog, canManageMembers } =
    await requireAdminPageAccess()
  const [metrics, overview] = await Promise.all([
    getOverviewForAdmin(context),
    getCatalogOverview(context),
  ])

  return (
    <AdminShell title="Platform overview" eyebrow="Admin">
      <div className="space-y-6">
        {!isOwner ? <AdminSetupBanner role={context.role} /> : null}
        <AdminOverviewMetricsCards metrics={metrics} />
        {canManageCatalog || canManageMembers ? (
          <div className="flex flex-wrap gap-3">
            {canManageCatalog ? (
              <Button asChild>
                <Link href="/admin/venues/new">Add venue</Link>
              </Button>
            ) : null}
            {canManageMembers ? (
              <Button asChild variant="outline">
                <Link href="/admin/members">Manage members</Link>
              </Button>
            ) : null}
            {canManageCatalog ? (
              <Button asChild variant="outline">
                <Link href="/admin/vendors">Manage vendors</Link>
              </Button>
            ) : null}
          </div>
        ) : null}
        <OperatorOverviewCards overview={overview} />
        <OperatorVenueList overview={overview} venueHrefPrefix="/admin/venues" />
      </div>
    </AdminShell>
  )
}
