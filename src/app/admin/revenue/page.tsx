import { AdminRevenueDashboard } from "@/components/admin/admin-revenue-dashboard"
import { AdminShell } from "@/components/admin/admin-shell"
import { adminShellUser } from "@/components/admin/admin-utils"
import {
  getRevenueByDayForAdmin,
  getRevenueByVenueForAdmin,
} from "@/server/admin/analytics-service"
import { requireAdminPageAccess } from "@/server/admin/gate"

export const dynamic = "force-dynamic"

const PERIODS = [7, 30, 90] as const

type PageProps = {
  searchParams: Promise<{ days?: string }>
}

export default async function AdminRevenuePage({ searchParams }: PageProps) {
  const access = await requireAdminPageAccess()
  const params = await searchParams
  const requested = Number(params.days)
  const days = (PERIODS as readonly number[]).includes(requested) ? requested : 30

  const since = new Date()
  since.setDate(since.getDate() - days)

  // Twice the period so the dashboard can compare with the period before.
  const [byVenue, byDay] = await Promise.all([
    getRevenueByVenueForAdmin(access.context, since),
    getRevenueByDayForAdmin(access.context, days * 2),
  ])

  return (
    <AdminShell
      title="Revenue"
      subtitle="Paid revenue across venues and time."
      backHref="/admin"
      user={adminShellUser(access)}
    >
      <AdminRevenueDashboard
        byVenue={byVenue}
        byDay={byDay}
        days={days}
        periods={[...PERIODS]}
      />
    </AdminShell>
  )
}
