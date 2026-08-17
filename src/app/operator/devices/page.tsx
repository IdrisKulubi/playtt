import { OperatorDevicesPanel } from "@/components/operator/operator-devices-panel"
import { OperatorShell } from "@/components/operator/operator-shell"
import { HURLINGHAM_VENUE_ID } from "@/server/catalog/constants"
import { listDevicesForOperator } from "@/server/devices/devices-service"
import { isDeviceRegistryEnabledForTenant } from "@/server/devices/feature-policy"
import { requireOperatorPageAccess } from "@/server/operator/gate"
import { listResources, listVenues } from "@/server/operator/service"
import { canPerformTenantAction } from "@/server/tenancy/permissions"
import { redirect } from "next/navigation"

export const dynamic = "force-dynamic"

export default async function OperatorDevicesPage() {
  const { context } = await requireOperatorPageAccess()

  if (!(await isDeviceRegistryEnabledForTenant(context))) {
    redirect("/operator")
  }

  const venues = await listVenues(context)
  const selectedVenueId = venues.find((v) => v.id === HURLINGHAM_VENUE_ID)?.id
    ?? venues[0]?.id
    ?? HURLINGHAM_VENUE_ID
  const resources = selectedVenueId
    ? await listResources(context, selectedVenueId)
    : []
  const devices = await listDevicesForOperator(context, selectedVenueId)
  const canManage = canPerformTenantAction(context.role, "venue.manage")

  return (
    <OperatorShell
      title="Devices"
      eyebrow="Operator"
      backHref="/operator"
    >
      <OperatorDevicesPanel
        venues={venues}
        resources={resources}
        devices={devices}
        selectedVenueId={selectedVenueId}
        canManage={canManage}
      />
    </OperatorShell>
  )
}
