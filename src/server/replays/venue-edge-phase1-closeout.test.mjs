import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"

const repoRoot = join(import.meta.dirname, "..", "..", "..")

test("venue edge rollout and audit wiring is present in config v2 services", () => {
  const publication = readFileSync(
    join(repoRoot, "src/server/replays/edge-config-v2-publication.ts"),
    "utf8",
  )
  const applications = readFileSync(
    join(repoRoot, "src/server/replays/edge-config-v2-applications.ts"),
    "utf8",
  )
  const repository = readFileSync(
    join(repoRoot, "src/server/replays/edge-config-v2-repository.ts"),
    "utf8",
  )
  const gate = readFileSync(
    join(repoRoot, "src/server/replays/venue-edge-config-v2-gate.ts"),
    "utf8",
  )
  const operatorService = readFileSync(
    join(repoRoot, "src/server/operator/service.ts"),
    "utf8",
  )

  assert.match(publication, /assertVenueEdgeConfigV2Enabled/)
  assert.match(publication, /VENUE_EDGE_AUDIT_ACTIONS\.configPublished/)
  assert.match(publication, /writeAuditLogInTransaction/)
  assert.match(applications, /VENUE_EDGE_AUDIT_ACTIONS\.configApplied/)
  assert.match(applications, /VENUE_EDGE_AUDIT_ACTIONS\.configRejected/)
  assert.match(repository, /assertVenueEdgeConfigV2Enabled/)
  assert.match(gate, /isVenueEdgeConfigV2EnabledForLocation/)
  assert.match(operatorService, /VENUE_EDGE_AUDIT_ACTIONS\.rolloutUpdated/)
})

test("feature flag keys include venue_edge_config_v2 rollout", () => {
  const keys = readFileSync(
    join(repoRoot, "src/server/operator/feature-flag-keys.ts"),
    "utf8",
  )
  assert.match(keys, /venue_edge_config_v2/)
})
