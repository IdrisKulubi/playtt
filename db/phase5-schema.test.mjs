import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const schema = readFileSync(new URL("./schema.ts", import.meta.url), "utf8")
const seed = readFileSync(new URL("./seed-phase1.sql", import.meta.url), "utf8")
const accessMigration = readFileSync(
  new URL("../drizzle/0022_phase5_access_grants.sql", import.meta.url),
  "utf8"
)
const ttlockMigration = readFileSync(
  new URL("../drizzle/0023_phase5_ttlock_inventory.sql", import.meta.url),
  "utf8"
)
const automationMigration = readFileSync(
  new URL("../drizzle/0024_phase5_notifications_relays.sql", import.meta.url),
  "utf8"
)

test("Phase 5 schema stores access and provider secrets as encrypted envelopes", () => {
  assert.match(schema, /export const accessGrants = pgTable/)
  assert.match(schema, /encryptedCode: text\("encrypted_code"\)\.notNull\(\)/)
  assert.match(
    schema,
    /encryptionKeyVersion: text\("encryption_key_version"\)\.notNull\(\)/
  )
  assert.doesNotMatch(schema, /accessCode:\s*text\("access_code"\)/)
  assert.match(
    schema,
    /encryptedClientSecret: text\("encrypted_client_secret"\)\.notNull\(\)/
  )
  assert.match(schema, /encryptedAccessToken: text\("encrypted_access_token"\)/)
  assert.match(
    schema,
    /encryptedRefreshToken: text\("encrypted_refresh_token"\)/
  )
  const connectionDeclaration = schema.slice(
    schema.indexOf("export const ttlockConnections"),
    schema.indexOf("export const ttlockVenueConnections")
  )
  assert.doesNotMatch(connectionDeclaration, /password/i)
})

test("legacy credentials are handled before per-door columns become required", () => {
  const addNullable = accessMigration.indexOf('ADD COLUMN "grant_id" uuid;')
  const backfill = accessMigration.indexOf('INSERT INTO "access_grants"')
  const guard = accessMigration.indexOf("Phase 5 migration cannot map")
  const makeRequired = accessMigration.indexOf(
    'ALTER COLUMN "grant_id" SET NOT NULL'
  )
  const removePlaintext = accessMigration.indexOf('DROP COLUMN "access_code"')

  assert.ok(addNullable >= 0)
  assert.ok(addNullable < backfill)
  assert.ok(backfill < guard)
  assert.ok(guard < makeRequired)
  assert.ok(makeRequired < removePlaintext)
})

test("Phase 5 tables enforce tenant-safe composite references", () => {
  for (const constraint of [
    "access_grants_tenant_booking_fk",
    "access_credentials_tenant_grant_fk",
    "access_credentials_tenant_access_point_fk",
    "access_credentials_tenant_lock_device_fk",
  ]) {
    assert.match(accessMigration, new RegExp(constraint))
  }

  for (const constraint of [
    "ttlock_venue_connections_tenant_location_fk",
    "ttlock_gateways_tenant_connection_fk",
    "ttlock_locks_tenant_gateway_fk",
    "ttlock_access_point_locks_tenant_point_fk",
    "ttlock_unlock_records_tenant_credential_fk",
  ]) {
    assert.match(ttlockMigration, new RegExp(constraint))
  }

  for (const constraint of [
    "relay_channels_tenant_location_fk",
    "relay_channels_tenant_resource_fk",
    "relay_channels_tenant_device_fk",
  ]) {
    assert.match(automationMigration, new RegExp(constraint))
  }
})

test("Phase 5 lifecycle states and relay commands are represented", () => {
  for (const state of ["provisioning", "modifying", "retrying", "revoking"]) {
    assert.match(schema, new RegExp(`"${state}"`))
  }
  assert.match(schema, /"relay_controller"/)
  assert.match(schema, /"set_output"/)
  assert.match(schema, /export const relayChannels = pgTable/)
})

test("Phase 5 rollout flags seed disabled", () => {
  for (const flag of [
    "live_access",
    "ttlock_provider",
    "relay_automation",
    "access_notifications",
    "remote_unlock",
  ]) {
    assert.match(seed, new RegExp(`\\('${flag}', false\\)`))
  }
})

test("push delivery has encrypted tokens, preferences, and durable deduplication", () => {
  assert.match(automationMigration, /CREATE TABLE "notification_preferences"/)
  assert.match(automationMigration, /CREATE TABLE "push_device_tokens"/)
  assert.match(automationMigration, /"encrypted_token" text NOT NULL/)
  assert.match(automationMigration, /notifications_tenant_deduplication_unique/)
  assert.match(automationMigration, /notifications_delivery_retry_idx/)
})
