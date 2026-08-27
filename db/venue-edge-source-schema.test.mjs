import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const schema = readFileSync(new URL("./schema.ts", import.meta.url), "utf8")
const migration = readFileSync(
  new URL("../drizzle/0025_phase1_venue_edge_sources.sql", import.meta.url),
  "utf8"
)
const pairingMigration = readFileSync(
  new URL("../drizzle/0026_venue_edge_pairing_sessions.sql", import.meta.url),
  "utf8"
)

const newTables = [
  "replay_recorders",
  "replay_camera_sources",
  "replay_source_routes",
  "replay_source_policies",
  "venue_edge_secret_refs",
  "venue_edge_installations",
  "venue_edge_config_revisions",
  "venue_edge_config_applications",
  "replay_source_health",
  "replay_capture_attempts",
]

const pairingTables = [
  "venue_edge_pairing_sessions",
  "venue_edge_pairing_rate_limits",
]

test("venue-edge source foundation is additive and leaves v1 assignments intact", () => {
  for (const table of newTables) {
    assert.match(migration, new RegExp(`CREATE TABLE "${table}"`))
  }

  assert.doesNotMatch(migration, /DROP (?:TABLE|COLUMN|TYPE|INDEX)/i)
  assert.doesNotMatch(migration, /ALTER TABLE "device_assignments"/)
  assert.match(
    migration,
    /ALTER TABLE "replay_requests" ADD COLUMN "config_revision_id" uuid;/
  )
  assert.match(
    migration,
    /ALTER TABLE "replay_requests" ADD COLUMN "selected_camera_source_id" uuid;/
  )
})

test("venue-edge pairing session migration is additive", () => {
  for (const table of pairingTables) {
    assert.match(pairingMigration, new RegExp(`CREATE TABLE "${table}"`))
    assert.match(schema, new RegExp(table))
  }

  assert.doesNotMatch(pairingMigration, /DROP (?:TABLE|COLUMN|TYPE|INDEX)/i)
})

test("routes model ordered cameras and ordered non-empty capture modes", () => {
  assert.match(
    migration,
    /"capture_modes" "replay_source_capture_mode"\[\] NOT NULL/
  )
  assert.match(migration, /replay_source_routes_capture_modes_nonempty/)
  assert.match(
    migration,
    /cardinality\("replay_source_routes"\."capture_modes"\) > 0/
  )
  assert.match(migration, /replay_source_routes_priority_positive/)
  assert.match(
    migration,
    /replay_source_routes_location_priority_active_unique/
  )
  assert.match(migration, /replay_source_routes_source_active_unique/)
  assert.match(
    schema,
    /captureMode: replaySourceCaptureModeEnum\("capture_mode"\)\.notNull\(\)/
  )
})

test("resource policy supports automatic failover and audited manual override", () => {
  for (const column of [
    "selection_mode",
    "manual_source_id",
    "override_expires_at",
    "override_reason",
    "override_actor_id",
    "failure_threshold",
    "healthy_threshold",
    "cooldown_seconds",
    "auto_failback",
  ]) {
    assert.match(migration, new RegExp(`"${column}"`))
  }

  assert.match(migration, /replay_source_policies_manual_override_valid/)
  assert.match(
    migration,
    /coalesce\(length\("replay_source_policies"\."override_reason"\), 0\) > 0/
  )
  assert.match(
    migration,
    /coalesce\(length\("replay_source_policies"\."override_actor_id"\), 0\) > 0/
  )
  assert.match(migration, /replay_source_policies_thresholds_positive/)
  assert.match(
    migration,
    /replay_source_policies_tenant_location_manual_route_fk/
  )
})

test("installation metadata is one-to-one with a same-venue edge device", () => {
  for (const column of [
    "installation_uid",
    "display_name",
    "platform",
    "architecture",
    "current_agent_version",
    "desired_agent_version",
    "update_channel",
    "installed_at",
    "last_config_applied_at",
  ]) {
    assert.match(migration, new RegExp(`"${column}"`))
  }

  assert.match(migration, /venue_edge_installations_tenant_device_unique/)
  assert.match(migration, /venue_edge_installations_tenant_uid_unique/)
  assert.match(migration, /"installation_uid" uuid NOT NULL/)
  assert.doesNotMatch(migration, /venue_edge_installations_uid_present/)
  assert.match(migration, /venue_edge_installations_tenant_location_device_fk/)
})

test("tenant and location boundaries are enforced by composite foreign keys", () => {
  for (const constraint of [
    "replay_camera_sources_tenant_location_recorder_fk",
    "replay_camera_sources_tenant_location_device_fk",
    "replay_source_routes_tenant_location_resource_fk",
    "replay_source_routes_tenant_location_source_fk",
    "replay_source_policies_tenant_location_resource_fk",
    "replay_source_policies_tenant_location_manual_route_fk",
    "venue_edge_secret_refs_tenant_location_device_fk",
    "venue_edge_secret_refs_tenant_location_recorder_fk",
    "venue_edge_installations_tenant_location_device_fk",
    "venue_edge_config_applications_tenant_location_device_fk",
    "venue_edge_config_applications_tenant_location_revision_fk",
    "replay_source_health_tenant_location_device_fk",
    "replay_source_health_tenant_location_recorder_source_fk",
    "replay_capture_attempts_tenant_location_request_fk",
    "replay_capture_attempts_tenant_location_revision_fk",
    "replay_capture_attempts_tenant_location_route_source_fk",
    "replay_capture_attempts_tenant_location_recorder_source_fk",
    "replay_requests_tenant_location_config_revision_fk",
    "replay_requests_tenant_location_selected_source_fk",
  ]) {
    assert.match(migration, new RegExp(`CONSTRAINT "${constraint}"`))
  }

  for (const supportingIndex of [
    "devices_tenant_location_id_unique",
    "resources_tenant_location_id_unique",
    "replay_requests_tenant_location_id_unique",
  ]) {
    assert.match(
      migration,
      new RegExp(`CREATE UNIQUE INDEX "${supportingIndex}"`)
    )
  }
})

test("new recorder and camera schema stores local references, not raw secrets or URLs", () => {
  const tableSql = newTables
    .map((table) => {
      const match = migration.match(
        new RegExp(`CREATE TABLE "${table}" \\([\\s\\S]*?\\n\\);`)
      )
      assert.ok(match, `expected CREATE TABLE block for ${table}`)
      return match[0]
    })
    .join("\n")

  assert.doesNotMatch(
    tableSql,
    /"(?:password|secret|token|rtsp_url|playback_url)"/i
  )
  assert.match(tableSql, /"local_key" text NOT NULL/)
  assert.match(migration, /replay_recorders_host_not_credentialized/)
  assert.match(migration, /replay_camera_sources_live_path_relative/)
})
