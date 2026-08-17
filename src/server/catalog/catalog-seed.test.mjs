import { readFileSync } from "node:fs"
import { join } from "node:path"
import assert from "node:assert/strict"
import test from "node:test"

const root = join(import.meta.dirname, "..", "..", "..")
const seedSql = readFileSync(join(root, "db", "seed-phase1.sql"), "utf8")

test("seed-phase1.sql inserts tenants before venues", () => {
  const tenantIndex = seedSql.indexOf("insert into tenants")
  const locationIndex = seedSql.indexOf("insert into locations")
  assert.ok(tenantIndex >= 0)
  assert.ok(locationIndex > tenantIndex)
})

test("seed-phase1.sql backfills Hurlingham with PlayTT tenant and brand", () => {
  assert.match(seedSql, /11111111-1111-1111-1111-111111111111/)
  assert.match(seedSql, /33333333-3333-3333-3333-333333333333/)
  assert.match(seedSql, /44444444-4444-4444-4444-444444444444/)
  assert.match(seedSql, /gracePeriodMinutes/)
})

test("seed-phase1.sql seeds Main Hall zone and table_tennis_table type", () => {
  assert.match(seedSql, /55555555-5555-5555-5555-555555555555/)
  assert.match(seedSql, /66666666-6666-6666-6666-666666666666/)
  assert.match(seedSql, /main-hall/)
  assert.match(seedSql, /table_tennis_table/)
})

test("seed-phase1.sql assigns Table 01 and tt_standard_v1 to Main Pod", () => {
  assert.match(seedSql, /'Table 01'/)
  assert.match(seedSql, /tt_standard_v1/)
  assert.match(seedSql, /'pod'/)
})

test("seed-phase1.sql inserts six resource capabilities idempotently", () => {
  assert.match(seedSql, /insert into resource_capabilities/i)
  assert.match(seedSql, /'scoring'/)
  assert.match(seedSql, /'replay'/)
  assert.match(seedSql, /'access'/)
  assert.match(seedSql, /'lighting'/)
  assert.match(seedSql, /'display'/)
  assert.match(seedSql, /'camera'/)
  assert.match(seedSql, /where not exists/i)
})

test("seed-phase1.sql seeds Hurlingham access points and Table 01 door journey", () => {
  assert.match(seedSql, /77777777-7777-7777-7777-777777777777/)
  assert.match(seedSql, /88888888-8888-8888-8888-888888888888/)
  assert.match(seedSql, /main-entrance/)
  assert.match(seedSql, /main-hall-door/)
  assert.match(seedSql, /insert into access_point_resources/i)
  assert.doesNotMatch(seedSql, /ttlock/i)
})

test("seed-phase1.sql keeps tenant-scoped unique index targets in schema migration", () => {
  const migrationSql = readFileSync(
    join(root, "drizzle", "0007_venue_resource_catalog.sql"),
    "utf8",
  )
  assert.match(migrationSql, /locations_tenant_slug_unique/)
  assert.match(migrationSql, /resources_tenant_location_code_unique/)
})
