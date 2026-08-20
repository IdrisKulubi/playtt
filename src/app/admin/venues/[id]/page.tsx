import Link from "next/link"
import { notFound } from "next/navigation"

import { AdminVenueCatalogForms } from "@/components/admin/admin-catalog-forms"
import { AdminShell } from "@/components/admin/admin-shell"
import { OperatorVenueDetail } from "@/components/operator/operator-venue-detail"
import { Button } from "@/components/ui/button"
import { requireAdminPageAccess } from "@/server/admin/gate"
import { listDevicesForOperator } from "@/server/devices/devices-service"
import { getVenueCatalogDetail } from "@/server/operator/service"
import { canPerformTenantAction } from "@/server/tenancy/permissions"

export const dynamic = "force-dynamic"

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function AdminVenueDetailPage({ params }: PageProps) {
  const { id } = await params
  const { context, isOwner } = await requireAdminPageAccess()
  const detail = await getVenueCatalogDetail(context, id)

  if (!detail) {
    notFound()
  }

  const devices = await listDevicesForOperator(context, id)
  const canManage = canPerformTenantAction(context.role, "catalog.manage")

  return (
    <AdminShell
      title={detail.venue.name}
      eyebrow="Venue catalog"
      backHref="/admin/venues"
    >
      <div className="space-y-6">
        <div className="flex flex-wrap gap-3">
          <Button asChild variant="outline">
            <Link href={`/admin/devices?venueId=${id}`}>Manage devices ({devices.length})</Link>
          </Button>
        </div>
        <OperatorVenueDetail detail={detail} canManage={canManage} />
        {isOwner ? (
          <AdminVenueCatalogForms
            venueId={id}
            zones={detail.zones.map((zone) => ({ id: zone.id, name: zone.name }))}
            canManage={canManage}
          />
        ) : null}
      </div>
    </AdminShell>
  )
}
