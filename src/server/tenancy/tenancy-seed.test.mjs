import { readFileSync } from "node:fs"
import { join } from "node:path"
import assert from "node:assert/strict"
import test from "node:test"

const root = join(import.meta.dirname, "..", "..", "..")
const seedSql = readFileSync(join(root, "db", "seed-phase1.sql"), "utf8")

test("seed-phase1.sql inserts deterministic PlayTT tenant and brand", () => {
  assert.match(seedSql, /33333333-3333-3333-3333-333333333333/)
  assert.match(seedSql, /44444444-4444-4444-4444-444444444444/)
  assert.match(seedSql, /insert into tenants/i)
  assert.match(seedSql, /insert into brands/i)
})

test("seed-phase1.sql backfills customer memberships without duplicating", () => {
  assert.match(seedSql, /insert into tenant_memberships/i)
  assert.match(seedSql, /'customer'/)
  assert.match(seedSql, /where not exists/i)
})
