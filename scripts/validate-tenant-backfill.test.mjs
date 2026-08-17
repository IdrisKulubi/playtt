import assert from "node:assert/strict"
import test from "node:test"

import {
  TENANT_MISMATCH_CHECKS,
  TENANT_SCOPED_TABLES,
  buildNullTenantCountQuery,
} from "../src/server/tenancy/backfill-queries.mjs"

test("TENANT_SCOPED_TABLES includes commercial and operational tables", () => {
  assert.ok(TENANT_SCOPED_TABLES.includes("bookings"))
  assert.ok(TENANT_SCOPED_TABLES.includes("payments"))
  assert.ok(TENANT_SCOPED_TABLES.includes("coach_insights"))
  assert.equal(TENANT_SCOPED_TABLES.length, 20)
})

test("buildNullTenantCountQuery targets tenant_id null rows", () => {
  assert.match(buildNullTenantCountQuery("bookings"), /bookings where tenant_id is null/i)
})

test("TENANT_MISMATCH_CHECKS cover catalog, booking, and payment parent joins", () => {
  const names = TENANT_MISMATCH_CHECKS.map((check) => check.name)
  assert.ok(names.includes("locations_brand_tenant"))
  assert.ok(names.includes("zones_location_tenant"))
  assert.ok(names.includes("resources_location_tenant"))
  assert.ok(names.includes("resources_zone_tenant"))
  assert.ok(names.includes("resources_resource_type_tenant"))
  assert.ok(names.includes("resource_capabilities_resource_tenant"))
  assert.ok(names.includes("bookings_location_tenant"))
  assert.ok(names.includes("payments_booking_tenant"))
})
