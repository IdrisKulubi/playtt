import { AdminShell } from "@/components/admin/admin-shell"
import { AdminVenueSelector } from "@/components/admin/admin-catalog-forms"
import { adminShellUser } from "@/components/admin/admin-utils"
import { NvrFleetPanel } from "@/components/nvr/nvr-fleet-panel"
import { NvrOnboardingPanel } from "@/components/nvr/nvr-onboarding-panel"
import { requireAdminPageAccess } from "@/server/admin/gate"
import { isDeviceRegistryEnabledForTenant } from "@/server/devices/feature-policy"
import { listVenueEdgeInstallations } from "@/server/replays/venue-edge-fleet"
import { listVenueEdgePairingSessions } from "@/server/replays/venue-edge-pairing-sessions"
import { getVenueEdgeInstallerArtifactMetadata } from "@/server/replays/venue-edge-installer-metadata"
import { HURLINGHAM_VENUE_ID } from "@/server/catalog/constants"
import { listVenues } from "@/server/operator/service"
import { canPerformTenantAction } from "@/server/tenancy/permissions"
import { redirect } from "next/navigation"

export const dynamic = "force-dynamic"

type PageProps = {
  searchParams: Promise<{ venueId?: string }>
}

export default async function NvrOnboardingPage({ searchParams }: PageProps) {
  const access = await requireAdminPageAccess()
  const params = await searchParams

  if (!(await isDeviceRegistryEnabledForTenant(access.context))) {
    redirect("/admin")
  }

  const venues = await listVenues(access.context)
  const selectedVenueId =
    params.venueId ??
    venues.find((venue) => venue.id === HURLINGHAM_VENUE_ID)?.id ??
    venues[0]?.id ??
    HURLINGHAM_VENUE_ID

  const sessions = selectedVenueId
    ? await listVenueEdgePairingSessions(access.context, selectedVenueId)
    : []

  const installations = selectedVenueId
    ? await listVenueEdgeInstallations(access.context, selectedVenueId)
    : []
  const preferredInstallation =
    installations.find((installation) => installation.connectivity === "online") ??
    installations[0]

  const canManage = canPerformTenantAction(access.context.role, "venue.manage")
  const installer = await getVenueEdgeInstallerArtifactMetadata(
    access.context,
    selectedVenueId
  )

  return (
    <AdminShell
      title="VenueEdge management"
      subtitle="Pair, monitor, and recover venue-edge agents without exposing device secrets."
      backHref="/admin"
      searchable={false}
      user={adminShellUser(access)}
    >
      <div className="space-y-6">
        <div className="admin-dashboard-card p-5">
          <AdminVenueSelector
            venues={venues}
            selectedVenueId={selectedVenueId}
            basePath="/nvr"
          />
        </div>
        <NvrFleetPanel
          selectedVenueId={selectedVenueId}
          initialInstallations={installations}
        />
        <div className="admin-dashboard-card p-5">
          <NvrOnboardingPanel
            selectedVenueId={selectedVenueId}
            canManage={canManage}
            installer={installer}
            initialSessions={sessions}
            initialInstallationHref={preferredInstallation?.nextAction.href ?? null}
          />
        </div>
      </div>
    </AdminShell>
  )
}
