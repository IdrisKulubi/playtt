import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"

import {
  PHASE5_INDEXES,
  PHASE5_MIGRATION_FILES,
  PHASE5_TABLES,
  classifyMigrationStatement,
  orderMigrationStatements,
  parseMigrationStatements,
  shouldSkipMigrationStatement,
} from "./lib/phase5-schema-expectations.mjs"

const root = join(import.meta.dirname, "..")

test("phase 5 migration files parse into statements", () => {
  for (const fileName of PHASE5_MIGRATION_FILES) {
    const content = readFileSync(join(root, "drizzle", fileName), "utf8")
    const statements = parseMigrationStatements(content)
    assert.ok(statements.length > 10, `${fileName} should contain multiple statements`)
  }
})

test("phase 5 inventory covers expected tables and indexes", () => {
  const accessMigration = readFileSync(
    join(root, "drizzle", "0022_phase5_access_grants.sql"),
    "utf8",
  )
  const ttlockMigration = readFileSync(
    join(root, "drizzle", "0023_phase5_ttlock_inventory.sql"),
    "utf8",
  )
  const automationMigration = readFileSync(
    join(root, "drizzle", "0024_phase5_notifications_relays.sql"),
    "utf8",
  )

  for (const tableName of PHASE5_TABLES) {
    const source =
      tableName === "access_grants"
        ? accessMigration
        : tableName.startsWith("ttlock_")
          ? ttlockMigration
          : automationMigration
    assert.match(source, new RegExp(`CREATE TABLE "${tableName}"`))
  }

  for (const indexName of [
    "access_grants_active_booking_unique",
    "ttlock_locks_connection_external_unique",
    "notifications_tenant_deduplication_unique",
  ]) {
    assert.ok(PHASE5_INDEXES.includes(indexName))
  }
})

test("migration statements run indexes before foreign keys", () => {
  const ttlockMigration = readFileSync(
    join(root, "drizzle", "0023_phase5_ttlock_inventory.sql"),
    "utf8",
  )
  const ordered = orderMigrationStatements(parseMigrationStatements(ttlockMigration))
  const lockFkIndex = ordered.findIndex((statement) =>
    statement.includes("ttlock_access_point_locks_tenant_lock_fk"),
  )
  const lockUniqueIndex = ordered.findIndex((statement) =>
    statement.includes("ttlock_locks_tenant_id_unique"),
  )
  assert.ok(lockUniqueIndex >= 0)
  assert.ok(lockFkIndex >= 0)
  assert.ok(lockUniqueIndex < lockFkIndex)
  assert.equal(classifyMigrationStatement("CREATE UNIQUE INDEX foo"), "index")
  assert.equal(
    classifyMigrationStatement(
      'ALTER TABLE "x" ADD CONSTRAINT "y" FOREIGN KEY ("a") REFERENCES "b"("id")',
    ),
    "fk",
  )
})

test("repair script skips the hard-fail guard and can be executed", () => {
  const accessMigration = readFileSync(
    join(root, "drizzle", "0022_phase5_access_grants.sql"),
    "utf8",
  )
  const guardStatement = parseMigrationStatements(accessMigration).find((statement) =>
    statement.includes("Phase 5 migration cannot map"),
  )
  assert.equal(shouldSkipMigrationStatement(guardStatement), "guard")

  const repairScript = readFileSync(
    join(root, "scripts", "repair-phase5-schema.mjs"),
    "utf8",
  )
  assert.match(repairScript, /--fix/)
  assert.match(repairScript, /--purge-unmappable-legacy/)
})
