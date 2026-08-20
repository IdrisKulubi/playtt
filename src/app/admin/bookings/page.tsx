import { AdminBookingsTable } from "@/components/admin/admin-operations-panels"
import { AdminShell } from "@/components/admin/admin-shell"
import { listBookingsForAdmin } from "@/server/admin/analytics-service"
import { requireAdminPageAccess } from "@/server/admin/gate"
import { listVenues } from "@/server/operator/service"

export const dynamic = "force-dynamic"

export default async function AdminBookingsPage() {
  const { context } = await requireAdminPageAccess()
  const [bookings, venues] = await Promise.all([
    listBookingsForAdmin(context, { limit: 200 }),
    listVenues(context),
  ])

  return (
    <AdminShell title="Bookings" eyebrow="Operations" backHref="/admin">
      <AdminBookingsTable bookings={bookings} venues={venues} />
    </AdminShell>
  )
}
