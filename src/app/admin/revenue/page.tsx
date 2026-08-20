import { AdminRevenuePanel } from "@/components/admin/admin-operations-panels"
import { AdminShell } from "@/components/admin/admin-shell"
import {
  getRevenueByDayForAdmin,
  getRevenueByVenueForAdmin,
} from "@/server/admin/analytics-service"
import { requireAdminPageAccess } from "@/server/admin/gate"

export const dynamic = "force-dynamic"

export default async function AdminRevenuePage() {
  const { context } = await requireAdminPageAccess()
  const since = new Date()
  since.setDate(since.getDate() - 30)

  const [byVenue, byDay] = await Promise.all([
    getRevenueByVenueForAdmin(context, since),
    getRevenueByDayForAdmin(context, 30),
  ])

  return (
    <AdminShell title="Revenue" eyebrow="Operations" backHref="/admin">
      <AdminRevenuePanel byVenue={byVenue} byDay={byDay} />
    </AdminShell>
  )
}
