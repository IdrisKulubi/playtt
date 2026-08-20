import Link from "next/link"

import { AdminBookingsTable } from "@/components/admin/admin-overview-charts"
import { AdminKpiGrid } from "@/components/admin/admin-dashboard"
import { AdminOverviewCharts } from "@/components/admin/admin-overview-charts"
import { AdminSetupBanner } from "@/components/admin/admin-setup-banner"
import { AdminShell } from "@/components/admin/admin-shell"
import { adminShellUser } from "@/components/admin/admin-utils"
import { Button } from "@/components/ui/button"
import {
  getOverviewForAdmin,
  getRevenueByDayForAdmin,
  listBookingsForAdmin,
} from "@/server/admin/analytics-service"
import { requireAdminPageAccess } from "@/server/admin/gate"

export const dynamic = "force-dynamic"

export default async function AdminOverviewPage() {
  const access = await requireAdminPageAccess()
  const { context, isOwner, canManageCatalog, canManageMembers } = access
  const [metrics, revenueByDay, recentBookings] = await Promise.all([
    getOverviewForAdmin(context),
    getRevenueByDayForAdmin(context, 30),
    listBookingsForAdmin(context, { limit: 8 }),
  ])

  return (
    <AdminShell
      title="Platform overview"
      subtitle="Monitor revenue, occupancy, and bookings across PlayTT."
      user={adminShellUser(access)}
      actions={
        canManageCatalog || canManageMembers ? (
          <>
            {canManageCatalog ? (
              <Button asChild size="sm">
                <Link href="/admin/venues/new">Add venue</Link>
              </Button>
            ) : null}
            {canManageCatalog ? (
              <Button asChild size="sm" variant="outline">
                <Link href="/admin/vendors">Manage vendors</Link>
              </Button>
            ) : null}
          </>
        ) : null
      }
    >
      {!isOwner ? <AdminSetupBanner role={context.role} /> : null}
      <AdminKpiGrid metrics={metrics} />
      <AdminOverviewCharts metrics={metrics} revenueByDay={revenueByDay} />
      <AdminBookingsTable
        bookings={recentBookings}
        title="Recent bookings"
        showViewAll
      />
    </AdminShell>
  )
}
