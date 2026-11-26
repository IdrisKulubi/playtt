import Link from "next/link"
import { notFound } from "next/navigation"
import { PlusIcon } from "@phosphor-icons/react/dist/ssr"

import { AdminVenueHealthStrip } from "@/components/admin/admin-health-overview"
import { AdminShell } from "@/components/admin/admin-shell"
import { adminShellUser } from "@/components/admin/admin-utils"
import { AdminVenueDetails } from "@/components/admin/admin-venue-details"
import {
  AdminVenueTables,
  type StrandedBookingRow,
  type VenueTableRow,
} from "@/components/admin/admin-venue-tables"
import { AdminScoreControllers } from "@/components/admin/admin-score-controllers"
import { AdminVenueWorkspace } from "@/components/admin/admin-venue-workspace"
import { NvrCameraAssignments } from "@/components/nvr/nvr-camera-assignments"
import { OperatorAccessPointPanels } from "@/components/operator/operator-access-points"
import { OperatorReplayRequestsPanel } from "@/components/operator/operator-replay-requests-panel"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { requireAdminPageAccess } from "@/server/admin/gate"
import { getTableReadiness } from "@/server/bookings/table-readiness"
import { listStrandedBookings } from "@/server/bookings/table-reassignment"
import {
  getVenueEdgeCapacityForLocation,
  listDevicesForOperator,
} from "@/server/devices/devices-service"
import { isDeviceRegistryEnabledForTenant } from "@/server/devices/feature-policy"
import { getVenueCatalogDetail } from "@/server/operator/service"
import { getVenueHealthSnapshot } from "@/server/operations/health-service"
import { listReplayRequestsForOperator } from "@/server/replays/replay-requests-service"
import {
  getVenueEdgeCameraAssignments,
  type CameraAssignmentsView,
} from "@/server/replays/venue-edge-camera-assignments"
import { listVenueEdgeInstallations } from "@/server/replays/venue-edge-fleet"
import type { TenantContext } from "@/server/tenancy/types"
import { canPerformTenantAction } from "@/server/tenancy/permissions"

export const dynamic = "force-dynamic"

type PageProps = {
  params: Promise<{ id: string }>
}

/** The venue PC (VenueEdge) for this venue and its current camera ↔ table assignments, if any. */
async function loadVenuePc(context: TenantContext, venueId: string) {
  if (!(await isDeviceRegistryEnabledForTenant(context))) return null
  const [installation] = await listVenueEdgeInstallations(context, venueId).catch(() => [])
  if (!installation) return null
  const assignments: CameraAssignmentsView | null = await getVenueEdgeCameraAssignments(
    context,
    installation.id,
    null,
  ).catch(() => null)
  return { id: installation.id, name: installation.displayName, assignments }
}

function strandedRow(
  booking: Awaited<ReturnType<typeof listStrandedBookings>>[number],
  timeZone: string,
): StrandedBookingRow {
  const day = new Intl.DateTimeFormat("en-KE", { weekday: "short", day: "numeric", month: "short", timeZone })
  const time = new Intl.DateTimeFormat("en-KE", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone })
  return {
    bookingId: booking.bookingId,
    tableName: booking.resourceName,
    firstName: booking.firstName,
    when: `${day.format(booking.startTime)}, ${time.format(booking.startTime)} – ${time.format(booking.endTime)}`,
    paid: booking.status === "confirmed",
  }
}

export default async function AdminVenueDetailPage({ params }: PageProps) {
  const { id } = await params
  const access = await requireAdminPageAccess()
  const detail = await getVenueCatalogDetail(access.context, id)

  if (!detail) {
    notFound()
  }

  const [devices, replayRequests, edgeCapacity, venueHealth, venuePc, readiness, stranded] = await Promise.all([
    listDevicesForOperator(access.context, id),
    listReplayRequestsForOperator(access.context, id),
    getVenueEdgeCapacityForLocation(access.context, id),
    getVenueHealthSnapshot(access.context, id),
    loadVenuePc(access.context, id),
    getTableReadiness(
      access.context.tenantId,
      detail.resources.map((resource) => resource.id),
    ),
    // The durable-work cycle moves what it can every minute; what's left needs staff.
    listStrandedBookings({ tenantId: access.context.tenantId, locationId: id }),
  ])
  const venueTimeZone = detail.venue.timezone || "Africa/Nairobi"
  const canManageVenue = canPerformTenantAction(access.context.role, "venue.manage")

  const zoneName = new Map(detail.zones.map((zone) => [zone.id, zone.name]))
  const cameraLabel = new Map((venuePc?.assignments?.cameras ?? []).map((camera) => [camera.id, camera.label]))
  const assignment = new Map((venuePc?.assignments?.tables ?? []).map((table) => [table.id, table]))
  const tables: VenueTableRow[] = detail.resources.map((resource) => {
    const assigned = assignment.get(resource.id)
    return {
      id: resource.id,
      name: resource.name,
      zoneName: resource.zoneId ? (zoneName.get(resource.zoneId) ?? null) : null,
      isActive: resource.isActive,
      cameraLabel: assigned?.primaryCameraId ? (cameraLabel.get(assigned.primaryCameraId) ?? null) : null,
      backupCameraLabel: assigned?.backupCameraId ? (cameraLabel.get(assigned.backupCameraId) ?? null) : null,
      readiness: readiness.get(resource.id) ?? { hasScoreInput: false, hasCamera: false },
    }
  })
  const tableCountByZone: Record<string, number> = {}
  for (const resource of detail.resources) {
    if (resource.zoneId) tableCountByZone[resource.zoneId] = (tableCountByZone[resource.zoneId] ?? 0) + 1
  }

  return (
    <AdminShell
      title={detail.venue.name}
      subtitle={detail.venue.address}
      backHref="/admin/venues"
      user={adminShellUser(access)}
      actions={
        <div className="flex gap-2">
          <Button asChild size="sm" variant="outline">
            <Link href={`/admin/devices?venueId=${id}`}>Devices ({devices.length})</Link>
          </Button>
          {access.canManageCatalog ? (
            <Button asChild size="sm">
              <Link href={`/admin/venues/${id}?tab=tables&add=1`} scroll={false}>
                <PlusIcon /> Add table
              </Link>
            </Button>
          ) : null}
        </div>
      }
    >
      <div className="space-y-6">
        {venueHealth ? <AdminVenueHealthStrip venue={venueHealth} /> : null}
        <AdminVenueWorkspace
          panels={{
            tables: (
              <AdminVenueTables
                venueId={id}
                tables={tables}
                zones={detail.zones.map((zone) => ({ id: zone.id, name: zone.name }))}
                canManage={access.canManageCatalog}
                hasVenuePc={Boolean(venuePc)}
                strandedBookings={stranded.map((booking) => strandedRow(booking, venueTimeZone))}
              />
            ),
            cameras: venuePc ? (
              <>
                <NvrCameraAssignments installationId={venuePc.id} canManage={canManageVenue} />
                <p className="text-sm text-muted-foreground">
                  Recorder, venue PC health and updates are in{" "}
                  <Link href={`/nvr/${venuePc.id}`} className="text-foreground underline-offset-4 hover:underline">
                    {venuePc.name}
                  </Link>
                  .
                </p>
              </>
            ) : (
              <Card>
                <CardContent className="space-y-3">
                  <h2 className="text-lg font-semibold">Cameras</h2>
                  <p className="max-w-xl text-sm text-muted-foreground">
                    This venue has no venue PC yet. Install VenueEdge on the PC next to the recorder and
                    pair it, then the cameras and their pictures appear here.
                  </p>
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/nvr?venueId=${id}`}>Set up a venue PC</Link>
                  </Button>
                </CardContent>
              </Card>
            ),
            controllers: <AdminScoreControllers venueId={id} canManage={canManageVenue} />,
            replays: (
              <OperatorReplayRequestsPanel
                venueId={id}
                initialRequests={replayRequests.map((request) => ({
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
                canManage={canManageVenue}
              />
            ),
            access: <OperatorAccessPointPanels detail={detail} canManage={canManageVenue} />,
            details: (
              <AdminVenueDetails
                venue={{
                  id: detail.venue.id,
                  slug: detail.venue.slug,
                  timezone: detail.venue.timezone,
                  address: detail.venue.address,
                  isActive: detail.venue.isActive,
                }}
                zones={detail.zones.map((zone) => ({ id: zone.id, name: zone.name }))}
                tableCountByZone={tableCountByZone}
                canManage={access.canManageCatalog}
              />
            ),
          }}
        />
      </div>
    </AdminShell>
  )
}
