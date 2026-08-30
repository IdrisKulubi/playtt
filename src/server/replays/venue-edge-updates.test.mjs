import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"

const repoRoot = join(import.meta.dirname, "..", "..", "..")

test("edge update routes require device auth", () => {
  const manifestRoute = readFileSync(
    join(repoRoot, "src/app/api/edge/v1/updates/manifest/route.ts"),
    "utf8",
  )
  const resultRoute = readFileSync(
    join(repoRoot, "src/app/api/edge/v1/updates/result/route.ts"),
    "utf8",
  )

  assert.match(manifestRoute, /requireDeviceRequest/)
  assert.match(resultRoute, /requireDeviceRequest/)
  assert.match(manifestRoute, /getVenueEdgeUpdateManifestForDevice/)
  assert.match(resultRoute, /recordVenueEdgeUpdateResult/)
})

test("operator update-actions route exists with audited actions", () => {
  const route = readFileSync(
    join(
      repoRoot,
      "src/app/api/operator/venue-edge/installations/[id]/update-actions/route.ts",
    ),
    "utf8",
  )

  assert.match(route, /change_channel/)
  assert.match(route, /pin_version/)
  assert.match(route, /retry_update/)
  assert.match(route, /publish_release/)
  assert.match(route, /resolveOperatorDeviceWriteContext/)
})

test("venue-edge update audit actions are defined", () => {
  const auditActions = readFileSync(
    join(repoRoot, "src/server/replays/venue-edge-audit-actions.ts"),
    "utf8",
  )

  assert.match(auditActions, /updateStarted/)
  assert.match(auditActions, /updateSucceeded/)
  assert.match(auditActions, /updateRolledBack/)
  assert.match(auditActions, /updateFailed/)
})

test("venue-edge update schema migration is additive", () => {
  const migration = readFileSync(
    join(repoRoot, "drizzle/0032_venue_edge_updates.sql"),
    "utf8",
  )

  assert.match(migration, /CREATE TABLE "venue_edge_releases"/)
  assert.match(migration, /CREATE TABLE "venue_edge_update_attempts"/)
  assert.match(migration, /ADD COLUMN "update_status"/)
  assert.doesNotMatch(migration, /DROP (?:TABLE|COLUMN)/i)
})
