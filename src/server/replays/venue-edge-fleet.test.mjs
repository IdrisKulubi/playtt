import { readFileSync } from "node:fs"
import { join } from "node:path"
import assert from "node:assert/strict"
import test from "node:test"

const repoRoot = join(import.meta.dirname, "..", "..", "..")

const SECRET_PATTERNS = [
  /password/i,
  /rtsp:\/\/[^\s"']+@/i,
  /deviceSecret/i,
  /pairingCode(?!Hint)/i,
  /credentialVersion/i,
  /Bearer\s+[A-Za-z0-9._-]+/,
]

function scanForSecrets(content, label) {
  for (const pattern of SECRET_PATTERNS) {
    assert.doesNotMatch(
      content,
      pattern,
      `${label} should not expose secrets matching ${pattern}`,
    )
  }
}

test("venue-edge fleet server module and APIs exist", () => {
  const fleet = readFileSync(
    join(repoRoot, "src/server/replays/venue-edge-fleet.ts"),
    "utf8",
  )
  const operatorActions = readFileSync(
    join(repoRoot, "src/server/replays/venue-edge-operator-actions.ts"),
    "utf8",
  )
  const listRoute = readFileSync(
    join(repoRoot, "src/app/api/operator/venue-edge/installations/route.ts"),
    "utf8",
  )
  const detailRoute = readFileSync(
    join(
      repoRoot,
      "src/app/api/operator/venue-edge/installations/[id]/route.ts",
    ),
    "utf8",
  )
  const actionsRoute = readFileSync(
    join(
      repoRoot,
      "src/app/api/operator/venue-edge/installations/[id]/actions/route.ts",
    ),
    "utf8",
  )

  assert.match(fleet, /listVenueEdgeInstallations/)
  assert.match(fleet, /getVenueEdgeInstallationDetail/)
  assert.match(fleet, /lastAppliedConfigRevision/)
  assert.match(fleet, /configRevisionId/)
  assert.doesNotMatch(fleet, /venueEdgeConfigApplications\.revisionId/)
  assert.match(operatorActions, /syncVenueEdgeCommissioning/)
  assert.match(operatorActions, /rollbackVenueEdgeInstallationConfig/)
  assert.match(listRoute, /resolveOperatorDeviceReadContext/)
  assert.match(detailRoute, /renameVenueEdgeInstallation/)
  assert.match(actionsRoute, /revokeVenueEdgeInstallation/)
})

test("fleet UI surfaces do not embed device or NVR secrets", () => {
  const fleetPanel = readFileSync(
    join(repoRoot, "src/components/nvr/nvr-fleet-panel.tsx"),
    "utf8",
  )
  const detail = readFileSync(
    join(repoRoot, "src/components/nvr/nvr-installation-detail.tsx"),
    "utf8",
  )
  const configStatus = readFileSync(
    join(repoRoot, "src/components/nvr/nvr-config-status.tsx"),
    "utf8",
  )
  const nvrPage = readFileSync(join(repoRoot, "src/app/nvr/page.tsx"), "utf8")
  const detailPage = readFileSync(
    join(repoRoot, "src/app/nvr/[installationId]/page.tsx"),
    "utf8",
  )

  scanForSecrets(fleetPanel, "nvr-fleet-panel.tsx")
  scanForSecrets(configStatus, "nvr-config-status.tsx")
  scanForSecrets(nvrPage, "nvr/page.tsx")
  scanForSecrets(detailPage, "nvr/[installationId]/page.tsx")

  assert.match(nvrPage, /NvrFleetPanel/)
  assert.match(nvrPage, /listVenueEdgeInstallations/)
  assert.match(detail, /replaceInstallationId/)
  assert.match(detail, /clearOverride/)
  assert.match(detail, /loopback/)
  assert.doesNotMatch(detail, /type=["']password["']/)
})

test("topology helpers count commissioning snapshot without secrets", () => {
  const topology = readFileSync(
    join(repoRoot, "src/server/replays/venue-edge-topology.ts"),
    "utf8",
  )

  assert.match(topology, /export function parseCommissioningSnapshot/)
  assert.match(topology, /export function countTopologyFromSnapshot/)
  assert.match(topology, /export function countSourceHealthFromMetrics/)
  assert.match(topology, /snapshot\.nvrs/)
  assert.match(topology, /metrics\?\.sourceHealth/)
  assert.doesNotMatch(topology, /password/i)
})

test("rollback publishes a new monotonic revision from prior snapshot", async () => {
  const topology = readFileSync(
    join(repoRoot, "src/server/replays/venue-edge-topology.ts"),
    "utf8",
  )

  assert.match(topology, /rollbackVenueEdgeConfigRevision/)
  assert.match(
    topology,
    /publishEdgeConfigV2Revision\([\s\S]+snapshot: revision\.snapshot/,
  )
})
