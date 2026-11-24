import { AdminBookingsList } from "@/components/admin/admin-bookings-list"
import { AdminShell } from "@/components/admin/admin-shell"
import { adminShellUser } from "@/components/admin/admin-utils"
import { listBookingsForAdmin } from "@/server/admin/analytics-service"
import { requireAdminPageAccess } from "@/server/admin/gate"

export const dynamic = "force-dynamic"

const BOOKING_LIMIT = 200

export default async function AdminBookingsPage() {
  const access = await requireAdminPageAccess()
  const bookings = await listBookingsForAdmin(access.context, { limit: BOOKING_LIMIT })

  return (
    <AdminShell
      title="Bookings"
      subtitle="Every booking across your venues and tables, in Nairobi time."
      backHref="/admin"
      user={adminShellUser(access)}
    >
      <AdminBookingsList bookings={bookings} limit={BOOKING_LIMIT} />
    </AdminShell>
  )
}
