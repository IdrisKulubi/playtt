import Link from "next/link"
import { notFound } from "next/navigation"

import { AdminVenueCatalogForms } from "@/components/admin/admin-catalog-forms"
import { AdminVenueHealthStrip } from "@/components/admin/admin-health-overview"
import { AdminShell } from "@/components/admin/admin-shell"
import { adminShellUser } from "@/components/admin/admin-utils"
import { OperatorVenueDetail } from "@/components/operator/operator-venue-detail"
import { Button } from "@/components/ui/button"
import { requireAdminPageAccess } from "@/server/admin/gate"
import {
  getVenueEdgeCapacityForLocation,
  listDevicesForOperator,
} from "@/server/devices/devices-service"
import { getVenueCatalogDetail } from "@/server/operator/service"
import { getVenueHealthSnapshot } from "@/server/operations/health-service"
import { listReplayRequestsForOperator } from "@/server/replays/replay-requests-service"
import { canPerformTenantAction } from "@/server/tenancy/permissions"

export const dynamic = "force-dynamic"

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function AdminVenueDetailPage({ params }: PageProps) {
  const { id } = await params
  const access = await requireAdminPageAccess()
  const detail = await getVenueCatalogDetail(access.context, id)

  if (!detail) {
    notFound()
  }

  const devices = await listDevicesForOperator(access.context, id)
  const [replayRequests, edgeCapacity, venueHealth] = await Promise.all([
    listReplayRequestsForOperator(access.context, id),
    getVenueEdgeCapacityForLocation(access.context, id),
    getVenueHealthSnapshot(access.context, id),
  ])
  const canManageVenue = canPerformTenantAction(
    access.context.role,
    "venue.manage",
  )

  return (
    <AdminShell
      title={detail.venue.name}
      subtitle={detail.venue.address}
      backHref="/admin/venues"
      user={adminShellUser(access)}
      actions={
        <Button asChild size="sm" variant="outline">
          <Link href={`/admin/devices?venueId=${id}`}>Devices ({devices.length})</Link>
        </Button>
      }
    >
      <div className="space-y-6">
        {venueHealth ? <AdminVenueHealthStrip venue={venueHealth} /> : null}
        <div className="admin-dashboard-card">
          <OperatorVenueDetail
            detail={detail}
            canManage={canManageVenue}
            replayRequests={replayRequests.map((request) => ({
              id: request.id,
              resourceId: request.resourceId,
              resourceName: request.resourceName,
              status: request.status,
              failureReason: request.failureReason,
              attempts: request.attempts,
              maxAttempts: request.maxAttempts,
              createdAt: request.createdAt.toISOString(),
              updatedAt: request.updatedAt.toISOString(),
            }))}
            edgeCapacity={edgeCapacity}
          />
        </div>
        {access.canManageCatalog ? (
          <AdminVenueCatalogForms
            venueId={id}
            zones={detail.zones.map((zone) => ({ id: zone.id, name: zone.name }))}
            canManage={access.canManageCatalog}
          />
        ) : null}
      </div>
    </AdminShell>
  )
}
