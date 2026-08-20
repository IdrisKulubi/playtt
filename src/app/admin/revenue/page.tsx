import { AdminRevenueDashboard } from "@/components/admin/admin-revenue-dashboard"
import { AdminShell } from "@/components/admin/admin-shell"
import { adminShellUser } from "@/components/admin/admin-utils"
import {
  getRevenueByDayForAdmin,
  getRevenueByVenueForAdmin,
} from "@/server/admin/analytics-service"
import { requireAdminPageAccess } from "@/server/admin/gate"

export const dynamic = "force-dynamic"

export default async function AdminRevenuePage() {
  const access = await requireAdminPageAccess()
  const since = new Date()
  since.setDate(since.getDate() - 30)

  const [byVenue, byDay] = await Promise.all([
    getRevenueByVenueForAdmin(access.context, since),
    getRevenueByDayForAdmin(access.context, 30),
  ])

  return (
    <AdminShell
      title="Revenue"
      subtitle="Paid revenue across venues and time."
      backHref="/admin"
      user={adminShellUser(access)}
    >
      <AdminRevenueDashboard byVenue={byVenue} byDay={byDay} />
    </AdminShell>
  )
}
