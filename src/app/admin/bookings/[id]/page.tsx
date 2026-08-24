import { notFound } from "next/navigation"

import { AdminBookingTimeline } from "@/components/admin/admin-booking-timeline"
import { AdminShell } from "@/components/admin/admin-shell"
import { adminShellUser } from "@/components/admin/admin-utils"
import { requireAdminPageAccess } from "@/server/admin/gate"
import { getBookingTimeline } from "@/server/operations/timeline-service"

export const dynamic = "force-dynamic"

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function AdminBookingDetailPage({ params }: PageProps) {
  const { id } = await params
  const access = await requireAdminPageAccess()
  const timeline = await getBookingTimeline(access.context, id)

  if (!timeline) {
    notFound()
  }

  return (
    <AdminShell
      title="Booking timeline"
      subtitle={`${timeline.summary.locationName} · ${timeline.summary.resourceName}`}
      backHref="/admin/bookings"
      user={adminShellUser(access)}
    >
      <AdminBookingTimeline timeline={timeline} />
    </AdminShell>
  )
}
