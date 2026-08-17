import { readFileSync } from "node:fs"
import { join } from "node:path"
import assert from "node:assert/strict"
import test from "node:test"

import {
  PLAYTT_TENANT_ID,
  TENANT_MISMATCH_CHECKS,
  TENANT_SCOPED_TABLES,
} from "../src/server/tenancy/backfill-queries.mjs"

const root = join(import.meta.dirname, "..")
const backfillSql = readFileSync(join(root, "db", "backfill-tenant-scope.sql"), "utf8")

test("backfill SQL uses PlayTT tenant constant and idempotent null guard", () => {
  assert.match(backfillSql, new RegExp(PLAYTT_TENANT_ID))
  assert.match(backfillSql, /where tenant_id is null/gi)
})

test("backfill SQL updates bookings from locations before child booking tables", () => {
  const bookingsIndex = backfillSql.indexOf("update bookings")
  const paymentsIndex = backfillSql.indexOf("update payments")
  assert.ok(bookingsIndex >= 0)
  assert.ok(paymentsIndex > bookingsIndex)
})

test("backfill SQL joins bookings for payments and modifications", () => {
  assert.match(backfillSql, /update payments[\s\S]*from bookings b/i)
  assert.match(backfillSql, /update booking_modifications[\s\S]*from bookings b/i)
})

test("backfill SQL backfills platform-scoped balances with PlayTT default", () => {
  assert.match(backfillSql, /update booking_credit_balances/i)
  assert.match(backfillSql, /update replay_credit_balances/i)
  assert.match(backfillSql, /update product_payments/i)
  assert.match(backfillSql, /update coach_subscriptions/i)
})

test("migration 0008 defines NOT VALID composite tenant foreign keys", () => {
  const migrationSql = readFileSync(
    join(root, "drizzle", "0008_tenant_scope_expand.sql"),
    "utf8",
  )
  assert.match(migrationSql, /bookings_tenant_location_fk[\s\S]*NOT VALID/i)
  assert.match(migrationSql, /payments_tenant_booking_fk[\s\S]*NOT VALID/i)
})

test("migration 0009 validates constraints and enforces tenant_id NOT NULL", () => {
  const migrationSql = readFileSync(
    join(root, "drizzle", "0009_tenant_scope_enforce.sql"),
    "utf8",
  )
  assert.match(migrationSql, /VALIDATE CONSTRAINT "bookings_tenant_location_fk"/)
  assert.match(migrationSql, /ALTER TABLE "bookings" ALTER COLUMN "tenant_id" SET NOT NULL/)
  assert.match(migrationSql, new RegExp(`SET DEFAULT '${PLAYTT_TENANT_ID}'`))
})
