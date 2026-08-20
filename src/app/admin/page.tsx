import Link from "next/link"

import { AdminOverviewMetricsCards, AdminShell } from "@/components/admin/admin-shell"
import { OperatorOverviewCards, OperatorVenueList } from "@/components/operator/operator-overview"
import { Button } from "@/components/ui/button"
import { getOverviewForAdmin } from "@/server/admin/analytics-service"
import { requireAdminPageAccess } from "@/server/admin/gate"
import { getCatalogOverview } from "@/server/operator/service"

export const dynamic = "force-dynamic"

export default async function AdminOverviewPage() {
  const { context, isOwner } = await requireAdminPageAccess()
  const [metrics, overview] = await Promise.all([
    getOverviewForAdmin(context),
    getCatalogOverview(context),
  ])

  return (
    <AdminShell title="Platform overview" eyebrow="Admin">
      <div className="space-y-6">
        <AdminOverviewMetricsCards metrics={metrics} />
        {isOwner ? (
          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/admin/venues/new">Add venue</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/admin/members">Manage members</Link>
            </Button>
          </div>
        ) : null}
        <OperatorOverviewCards overview={overview} />
        <OperatorVenueList overview={overview} venueHrefPrefix="/admin/venues" />
      </div>
    </AdminShell>
  )
}
