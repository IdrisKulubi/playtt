import { readFileSync } from "node:fs"
import { join } from "node:path"
import assert from "node:assert/strict"
import test from "node:test"

import {
  HURLINGHAM_MAIN_ENTRANCE_CODE,
  HURLINGHAM_MAIN_ENTRANCE_ID,
  MAIN_HALL_DOOR_CODE,
  MAIN_HALL_DOOR_ID,
  MAIN_POD_RESOURCE_ID,
} from "./constants.ts"

const repoRoot = join(import.meta.dirname, "..", "..", "..")
const catalogRoot = import.meta.dirname
const schemaSource = readFileSync(join(repoRoot, "db", "schema.ts"), "utf8")
const migrationSource = readFileSync(
  join(repoRoot, "drizzle", "0011_access_points.sql"),
  "utf8",
)
const seedSql = readFileSync(join(repoRoot, "db", "seed-phase1.sql"), "utf8")

test("schema defines logical access points without provider lock identifiers", () => {
  assert.match(schemaSource, /access_points/)
  assert.match(schemaSource, /access_point_resources/)
  assert.match(schemaSource, /access_point_kind/)
  assert.doesNotMatch(schemaSource, /ttlock/i)
  assert.doesNotMatch(schemaSource, /lockId/i)
})

test("migration adds tenant-scoped composite foreign keys for access mappings", () => {
  assert.match(migrationSource, /access_points_tenant_location_fk/)
  assert.match(migrationSource, /access_point_resources_tenant_access_point_fk/)
  assert.match(migrationSource, /access_point_resources_tenant_resource_fk/)
})

test("access point repository scopes queries by tenant context", () => {
  const source = readFileSync(join(catalogRoot, "access-points.ts"), "utf8")
  assert.match(source, /eq\(accessPoints\.tenantId, context\.tenantId\)/)
  assert.match(source, /eq\(accessPointResources\.tenantId, context\.tenantId\)/)
  assert.match(source, /asc\(accessPoints\.sortOrder\)/)
  assert.match(source, /asc\(accessPointResources\.sortOrder\)/)
})

test("resolveRequiredAccessPoints returns empty for unknown tenant resource ids", () => {
  const source = readFileSync(join(catalogRoot, "access-points.ts"), "utf8")
  assert.match(source, /if \(!resource\) {\s*return \[\]/s)
})

test("mapping mutations reject cross-venue attachments", () => {
  const source = readFileSync(join(catalogRoot, "access-points.ts"), "utf8")
  assert.match(source, /assertSameVenueMapping/)
  assert.match(
    source,
    /Access points and resources must belong to the same venue/,
  )
})

test("seed-phase1.sql seeds Hurlingham entrance and hall doors for Table 01", () => {
  assert.match(seedSql, new RegExp(HURLINGHAM_MAIN_ENTRANCE_ID))
  assert.match(seedSql, new RegExp(MAIN_HALL_DOOR_ID))
  assert.match(seedSql, new RegExp(HURLINGHAM_MAIN_ENTRANCE_CODE))
  assert.match(seedSql, new RegExp(MAIN_HALL_DOOR_CODE))
  assert.match(seedSql, /insert into access_point_resources/i)
  assert.match(seedSql, new RegExp(MAIN_POD_RESOURCE_ID))
  assert.doesNotMatch(seedSql, /ttlock/i)
})

test("operator write routes require catalog.manage", () => {
  for (const file of [
    "src/app/api/operator/access-points/route.ts",
    "src/app/api/operator/access-points/mappings/route.ts",
  ]) {
    const source = readFileSync(join(repoRoot, file), "utf8")
    assert.match(source, /catalog\.manage/)
  }
})

test("same human door code can exist in different tenant venues via tenant-location uniqueness", () => {
  assert.match(
    schemaSource,
    /access_points_tenant_location_code_unique/,
  )
})

test("resolveRequiredAccessPoints returns ordered Hurlingham doors for Table 01 when database is seeded", async (t) => {
  if (!process.env.POSTGRES_URL) {
    t.skip("POSTGRES_URL is not configured")
    return
  }

  const { resolveRequiredAccessPoints } = await import("./access-points.ts")
  const { PLAYTT_TENANT_ID } = await import("../tenancy/constants.ts")

  const operatorContext = {
    tenantId: PLAYTT_TENANT_ID,
    actor: { type: "user", id: "operator-1" },
    role: "operator",
    membershipId: "membership-operator",
    correlationId: "corr-access-points",
  }

  const doors = await resolveRequiredAccessPoints(
    operatorContext,
    MAIN_POD_RESOURCE_ID,
  )

  assert.equal(doors.length, 2)
  assert.equal(doors[0]?.id, HURLINGHAM_MAIN_ENTRANCE_ID)
  assert.equal(doors[1]?.id, MAIN_HALL_DOOR_ID)
})

test("resolveRequiredAccessPoints returns empty for guessed other-tenant resource ids", async (t) => {
  if (!process.env.POSTGRES_URL) {
    t.skip("POSTGRES_URL is not configured")
    return
  }

  const { resolveRequiredAccessPoints } = await import("./access-points.ts")
  const otherTenantContext = {
    tenantId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    actor: { type: "user", id: "other-tenant-user" },
    role: "operator",
    membershipId: "membership-other",
    correlationId: "corr-other-tenant",
  }

  const doors = await resolveRequiredAccessPoints(
    otherTenantContext,
    MAIN_POD_RESOURCE_ID,
  )

  assert.deepEqual(doors, [])
})
