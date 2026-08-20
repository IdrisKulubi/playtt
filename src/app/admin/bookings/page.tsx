import { AdminBookingsTable } from "@/components/admin/admin-overview-charts"
import { AdminShell } from "@/components/admin/admin-shell"
import { adminShellUser } from "@/components/admin/admin-utils"
import { listBookingsForAdmin } from "@/server/admin/analytics-service"
import { requireAdminPageAccess } from "@/server/admin/gate"

export const dynamic = "force-dynamic"

export default async function AdminBookingsPage() {
  const access = await requireAdminPageAccess()
  const bookings = await listBookingsForAdmin(access.context, { limit: 200 })

  return (
    <AdminShell
      title="Bookings"
      subtitle="All platform bookings across venues and tables."
      backHref="/admin"
      user={adminShellUser(access)}
    >
      <AdminBookingsTable bookings={bookings} title="Platform bookings" />
    </AdminShell>
  )
}
