import Link from "next/link"

import { AdminBookingsTable } from "@/components/admin/admin-overview-charts"
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
  const { context, isOwner, canManageCatalog } = access
  const [metrics, revenueByDay, recentBookings] = await Promise.all([
    getOverviewForAdmin(context),
    getRevenueByDayForAdmin(context, 30),
    listBookingsForAdmin(context, { limit: 8 }),
  ])

  return (
    <AdminShell
      title="Overview"
      subtitle="Revenue, bookings and the state of the platform at a glance."
      user={adminShellUser(access)}
      actions={
        canManageCatalog ? (
          <Button asChild size="sm" variant="ghost">
            <Link href="/admin/vendors">Vendors</Link>
          </Button>
        ) : null
      }
    >
      <div className="space-y-8">
        {!isOwner ? <AdminSetupBanner role={context.role} /> : null}
        <AdminOverviewCharts metrics={metrics} revenueByDay={revenueByDay} />
        <AdminBookingsTable bookings={recentBookings} title="Recent bookings" showViewAll />
      </div>
    </AdminShell>
  )
}
