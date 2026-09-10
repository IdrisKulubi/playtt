import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"

const repoRoot = join(import.meta.dirname, "..", "..", "..")

test("commissioning route is device-authenticated", () => {
  const route = readFileSync(
    join(
      repoRoot,
      "src",
      "app",
      "api",
      "edge",
      "v1",
      "commissioning",
      "route.ts",
    ),
    "utf8",
  )

  assert.match(route, /requireDeviceRequest/)
  assert.match(route, /publishVenueEdgeCommissioning/)
  assert.match(route, /\.strict\(\)/)
  assert.match(route, /\.max\(32\)/)
  assert.match(route, /\.max\(256\)/)
  assert.match(route, /\.max\(1_024\)/)
  assert.match(route, /reportVersion/)
  assert.match(route, /assertCommissioningReportChecksum/)
  assert.match(route, /reportChecksumSha256/)
  assert.doesNotMatch(route, /\.passthrough\(\)/)
})

test("commissioning service scans secrets and persists installation snapshot", () => {
  const service = readFileSync(
    join(repoRoot, "src", "server", "replays", "venue-edge-commissioning.ts"),
    "utf8",
  )

  assert.match(service, /commissioningSnapshotJson/)
  assert.match(service, /commissionedAt/)
  assert.match(service, /assertSafeCommissioningPayload/)
  assert.match(service, /VENUE_EDGE_AUDIT_ACTIONS\.commissioningPublished/)
  assert.match(service, /SECRET_KEY_PATTERN/)
  assert.match(service, /deviceType !== "venue_edge"/)
  assert.match(service, /"DEVICE_FORBIDDEN"/)
  assert.doesNotMatch(service, /DEVICE_TYPE_INVALID/)
  assert.match(service, /commissionedAt: commissioned \? now : null/)
  assert.match(
    service,
    /writeAuditLogInTransaction\(tx, input\.auditContext, \{/,
  )
  assert.doesNotMatch(service, /passwordStore/)
  assert.match(service, /hashCommissioningReport/)
  assert.match(service, /assertCommissioningReportChecksum/)
  assert.match(service, /lastReportChecksumSha256: reportChecksumSha256/)
})

test("commissioning migration adds durable installation fields", () => {
  const migration = readFileSync(
    join(repoRoot, "drizzle", "0029_venue_edge_commissioning.sql"),
    "utf8",
  )
  const schema = readFileSync(join(repoRoot, "db", "schema.ts"), "utf8")

  assert.match(migration, /commissioned_at/)
  assert.match(migration, /commissioning_snapshot_json/)
  assert.match(schema, /commissionedAt/)
  assert.match(schema, /commissioningSnapshotJson/)
})

test("commissioning checksum is verified on the raw body before schema parse", () => {
  const route = readFileSync(
    join(
      repoRoot,
      "src",
      "app",
      "api",
      "edge",
      "v1",
      "commissioning",
      "route.ts",
    ),
    "utf8",
  )
  const service = readFileSync(
    join(repoRoot, "src", "server", "replays", "venue-edge-commissioning.ts"),
    "utf8",
  )

  const checksumIndex = route.indexOf("assertCommissioningReportChecksum")
  const parseIndex = route.indexOf("commissioningSchema.parse")
  assert.ok(checksumIndex > 0)
  assert.ok(parseIndex > checksumIndex)
  assert.match(service, /hashCommissioningReport/)
  assert.match(route, /const rawPayload/)
})

test("topology reconciliation clears a superseded active route before inserting its replacement", () => {
  const topology = readFileSync(
    join(repoRoot, "src", "server", "replays", "venue-edge-topology.ts"),
    "utf8",
  )

  const routeLoop = topology.indexOf(
    "for (const route of input.snapshot.resourceRoutes ?? [])",
  )
  const supersededRouteUpdate = topology.indexOf(
    ".update(replaySourceRoutes)",
    routeLoop,
  )
  const routeInsert = topology.indexOf(".insert(replaySourceRoutes)", routeLoop)

  assert.ok(routeLoop > 0)
  assert.ok(supersededRouteUpdate > routeLoop)
  assert.ok(routeInsert > supersededRouteUpdate)
  assert.match(topology, /seenRoutePriorities/)
  assert.match(
    topology,
    /Two enabled cameras use the same priority for one table/,
  )
  assert.match(
    topology,
    /A table is mapped to a camera that is not present in this snapshot/,
  )
})

test("operator reconciliation returns a safe recovery message for database failures", () => {
  const actions = readFileSync(
    join(
      repoRoot,
      "src",
      "server",
      "replays",
      "venue-edge-operator-actions.ts",
    ),
    "utf8",
  )

  assert.match(actions, /VenueEdge snapshot reconciliation failed/)
  assert.match(actions, /No configuration was published/)
  assert.match(actions, /findDatabaseErrorMetadata/)
})
