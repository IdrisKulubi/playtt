import { readFileSync } from "node:fs"
import { join } from "node:path"
import assert from "node:assert/strict"
import test from "node:test"

const repoRoot = join(import.meta.dirname, "..", "..", "..")

test("nvr onboarding page and installer metadata exist", () => {
  const page = readFileSync(join(repoRoot, "src/app/nvr/page.tsx"), "utf8")
  const panel = readFileSync(
    join(repoRoot, "src/components/nvr/nvr-onboarding-panel.tsx"),
    "utf8"
  )
  const fleetPanel = readFileSync(
    join(repoRoot, "src/components/nvr/nvr-fleet-panel.tsx"),
    "utf8"
  )
  const metadata = readFileSync(
    join(repoRoot, "src/server/replays/venue-edge-installer-metadata.ts"),
    "utf8"
  )
  const downloadRoute = readFileSync(
    join(
      repoRoot,
      "src/app/api/operator/venue-edge/installer-download/route.ts"
    ),
    "utf8"
  )
  const registrationRoute = readFileSync(
    join(
      repoRoot,
      "src/app/api/operator/venue-edge/installer-releases/route.ts"
    ),
    "utf8"
  )
  const registrationService = readFileSync(
    join(repoRoot, "src/server/replays/venue-edge-installer-registration.ts"),
    "utf8"
  )
  const sidebar = readFileSync(
    join(repoRoot, "src/components/admin/admin-sidebar.tsx"),
    "utf8"
  )

  assert.match(page, /NvrOnboardingPanel/)
  assert.match(page, /NvrFleetPanel/)
  assert.match(page, /listVenueEdgeInstallations/)
  assert.match(page, /VenueEdge management/)
  assert.match(panel, /pairing-sessions/)
  assert.match(panel, /setInterval/)
  assert.match(panel, /pairingCode/)
  assert.match(panel, /acknowledgeUnsignedPilot/)
  assert.match(panel, /No terminal or developer tools/)
  assert.match(fleetPanel, /installations/)
  assert.match(fleetPanel, /Refresh/)
  assert.match(fleetPanel, /handleRemoveInstallation/)
  assert.match(fleetPanel, /Remove from fleet/)
  assert.doesNotMatch(panel, /deviceId|credentialVersion/)
  assert.match(metadata, /venueEdgeInstallerPilotEligibility/)
  assert.match(metadata, /venueEdgeInstallerDownloadAudits/)
  assert.match(downloadRoute, /resolveOperatorDeviceWriteContext/)
  assert.match(downloadRoute, /NextResponse\.redirect/)
  assert.match(registrationRoute, /VENUE_EDGE_RELEASE_REGISTRATION_TOKEN/)
  assert.match(registrationRoute, /timingSafeEqual/)
  assert.match(registrationRoute, /pilotLocationIds/)
  assert.match(registrationRoute, /targetTenantIds/)
  assert.match(
    registrationService,
    /inArray\(locations\.id, pilotLocationIds\)/
  )
  assert.doesNotMatch(
    registrationService,
    /where\(eq\(locations\.tenantId, tenantId\)\)/
  )
  assert.match(sidebar, /\/nvr/)
})
