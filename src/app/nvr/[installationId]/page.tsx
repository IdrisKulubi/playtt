import { AdminShell } from "@/components/admin/admin-shell"
import { NvrInstallationDetail } from "@/components/nvr/nvr-installation-detail"
import { adminShellUser } from "@/components/admin/admin-utils"
import { requireAdminPageAccess } from "@/server/admin/gate"
import { isDeviceRegistryEnabledForTenant } from "@/server/devices/feature-policy"
import { getVenueEdgeInstallationDetail } from "@/server/replays/venue-edge-fleet"
import { canPerformTenantAction } from "@/server/tenancy/permissions"
import { redirect } from "next/navigation"

export const dynamic = "force-dynamic"

type PageProps = {
  params: Promise<{ installationId: string }>
}

export default async function NvrInstallationPage({ params }: PageProps) {
  const access = await requireAdminPageAccess()
  const { installationId } = await params

  if (!(await isDeviceRegistryEnabledForTenant(access.context))) {
    redirect("/admin")
  }

  const installation = await getVenueEdgeInstallationDetail(
    access.context,
    installationId,
  )
  const canManage = canPerformTenantAction(access.context.role, "venue.manage")

  return (
    <AdminShell
      title={installation.displayName}
      subtitle="VenueEdge installation detail, topology, and recovery actions."
      backHref={`/nvr?venueId=${installation.locationId}`}
      searchable={false}
      user={adminShellUser(access)}
    >
      <NvrInstallationDetail installation={installation} canManage={canManage} />
    </AdminShell>
  )
}
