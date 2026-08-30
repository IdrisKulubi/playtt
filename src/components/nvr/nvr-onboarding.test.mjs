import { readFileSync } from "node:fs"
import { join } from "node:path"
import assert from "node:assert/strict"
import test from "node:test"

const repoRoot = join(import.meta.dirname, "..", "..", "..")

test("nvr onboarding page and installer metadata exist", () => {
  const page = readFileSync(join(repoRoot, "src/app/nvr/page.tsx"), "utf8")
  const panel = readFileSync(
    join(repoRoot, "src/components/nvr/nvr-onboarding-panel.tsx"),
    "utf8",
  )
  const fleetPanel = readFileSync(
    join(repoRoot, "src/components/nvr/nvr-fleet-panel.tsx"),
    "utf8",
  )
  const metadata = readFileSync(
    join(repoRoot, "src/server/replays/venue-edge-installer-metadata.ts"),
    "utf8",
  )
  const sidebar = readFileSync(
    join(repoRoot, "src/components/admin/admin-sidebar.tsx"),
    "utf8",
  )

  assert.match(page, /NvrOnboardingPanel/)
  assert.match(page, /NvrFleetPanel/)
  assert.match(page, /listVenueEdgeInstallations/)
  assert.match(page, /VenueEdge management/)
  assert.match(panel, /pairing-sessions/)
  assert.match(panel, /setInterval/)
  assert.match(panel, /pairingCode/)
  assert.match(fleetPanel, /installations/)
  assert.match(fleetPanel, /Refresh/)
  assert.match(fleetPanel, /handleDeleteInstallation/)
  assert.doesNotMatch(panel, /deviceId|credentialVersion/)
  assert.match(metadata, /placeholder: true/)
  assert.match(sidebar, /\/nvr/)
})
