#!/usr/bin/env node
import { createHash } from "node:crypto"
import { readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import postgres from "postgres"

import {
  orderMigrationStatements,
  parseMigrationStatements,
  SKIPPABLE_PG_CODES,
} from "./lib/phase5-schema-expectations.mjs"
import { PHASE5_TABLES } from "./lib/phase5-schema-expectations.mjs"

const VENUE_EDGE_TABLES = [
  "replay_camera_sources",
  "replay_capture_attempts",
  "replay_recorders",
  "replay_source_health",
  "replay_source_policies",
  "replay_source_routes",
  "venue_edge_config_applications",
  "venue_edge_config_revisions",
  "venue_edge_installations",
  "venue_edge_secret_refs",
]

const JOURNAL_CHECKS = [
  {
    tag: "0023_phase5_ttlock_inventory",
    tables: ["ttlock_connections", "ttlock_locks", "ttlock_access_point_locks"],
  },
  {
    tag: "0024_phase5_notifications_relays",
    tables: ["notification_preferences", "push_device_tokens", "relay_channels"],
  },
  {
    tag: "0025_phase1_venue_edge_sources",
    tables: VENUE_EDGE_TABLES,
    indexes: [
      "devices_tenant_location_id_unique",
      "replay_requests_tenant_location_id_unique",
      "resources_tenant_location_id_unique",
    ],
    constraints: [
      "replay_requests_tenant_location_config_revision_fk",
      "replay_requests_tenant_location_selected_source_fk",
    ],
  },
]

function requireDatabaseUrl() {
  const databaseUrl = process.env.POSTGRES_URL?.replace(/^['"]+|['"]+$/g, "").trim()
  if (!databaseUrl) {
    throw new Error(
      "POSTGRES_URL is required. Run with: node --env-file=.env.local scripts/repair-pending-migrations.mjs",
    )
  }
  return databaseUrl
}

function migrationHash(filePath) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex")
}

async function tableExists(sql, tableName) {
  const [row] = await sql`
    select 1 as ok
    from information_schema.tables
    where table_schema = 'public' and table_name = ${tableName}
    limit 1
  `
  return Boolean(row)
}

async function indexExists(sql, name) {
  const [row] = await sql`
    select 1 as ok
    from pg_indexes
    where schemaname = 'public' and indexname = ${name}
    limit 1
  `
  return Boolean(row)
}

async function constraintExists(sql, name) {
  const [row] = await sql`
    select 1 as ok
    from pg_constraint where conname = ${name}
    limit 1
  `
  return Boolean(row)
}

async function migrationRecorded(sql, hash) {
  const [row] = await sql`
    select 1 as ok from drizzle.__drizzle_migrations where hash = ${hash}
    limit 1
  `
  return Boolean(row)
}

async function verifyMigrationApplied(sql, check) {
  for (const tableName of check.tables) {
    if (!(await tableExists(sql, tableName))) {
      return { ok: false, reason: `missing table ${tableName}` }
    }
  }

  for (const indexName of check.indexes ?? []) {
    if (!(await indexExists(sql, indexName))) {
      return { ok: false, reason: `missing index ${indexName}` }
    }
  }

  for (const constraintName of check.constraints ?? []) {
    if (!(await constraintExists(sql, constraintName))) {
      return { ok: false, reason: `missing constraint ${constraintName}` }
    }
  }

  return { ok: true }
}

async function applyMigrationFile(sql, root, tag) {
  const filePath = join(root, "drizzle", `${tag}.sql`)
  const statements = orderMigrationStatements(
    parseMigrationStatements(readFileSync(filePath, "utf8")),
  )
  const result = { applied: 0, skipped: 0 }

  console.log(`Applying ${tag} (${statements.length} ordered statements)...`)
  for (const statement of statements) {
    try {
      await sql.unsafe(statement)
      result.applied += 1
    } catch (error) {
      if (SKIPPABLE_PG_CODES.has(error?.code)) {
        result.skipped += 1
        continue
      }
      const preview = statement.replace(/\s+/g, " ").slice(0, 140)
      throw new Error(
        `${tag} failed (${error?.code ?? "unknown"}): ${error?.message}\nStatement: ${preview}`,
      )
    }
  }

  return result
}

async function recordMigration(sql, tag, when) {
  const filePath = join(process.cwd(), "drizzle", `${tag}.sql`)
  const hash = migrationHash(filePath)
  if (await migrationRecorded(sql, hash)) {
    return false
  }

  await sql`
    insert into drizzle.__drizzle_migrations (hash, created_at)
    values (${hash}, ${when})
  `
  return true
}

async function main() {
  const root = process.cwd()
  const shouldFix = process.argv.includes("--fix")
  const journal = JSON.parse(
    readFileSync(join(root, "drizzle", "meta", "_journal.json"), "utf8"),
  )
  const sql = postgres(requireDatabaseUrl(), { max: 1 })

  try {
    const pending = []

    for (const check of JOURNAL_CHECKS) {
      const entry = journal.entries.find((row) => row.tag === check.tag)
      if (!entry) {
        throw new Error(`Journal entry missing for ${check.tag}`)
      }

      const hash = migrationHash(join(root, "drizzle", `${check.tag}.sql`))
      const recorded = await migrationRecorded(sql, hash)
      const verified = await verifyMigrationApplied(sql, check)

      console.log(
        `${check.tag}: recorded=${recorded ? "yes" : "no"} schema=${verified.ok ? "complete" : verified.reason}`,
      )

      if (!recorded) {
        pending.push({ check, entry, hash, verified })
      }
    }

    if (!shouldFix) {
      if (pending.length === 0) {
        console.log("\nDrizzle migration journal is in sync.")
        return
      }

      console.log("\nRe-run with --fix to apply missing SQL and record completed migrations.")
      process.exitCode = 1
      return
    }

    for (const item of pending) {
      if (!item.verified.ok) {
        await applyMigrationFile(sql, root, item.check.tag)
        item.verified = await verifyMigrationApplied(sql, item.check)
        if (!item.verified.ok) {
          throw new Error(`${item.check.tag} is still incomplete: ${item.verified.reason}`)
        }
      }

      if (await recordMigration(sql, item.check.tag, item.entry.when)) {
        console.log(`Recorded ${item.check.tag} in drizzle.__drizzle_migrations`)
      }
    }

    const remaining = []
    for (const check of JOURNAL_CHECKS) {
      const hash = migrationHash(join(root, "drizzle", `${check.tag}.sql`))
      if (!(await migrationRecorded(sql, hash))) {
        remaining.push(check.tag)
      }
    }

    if (remaining.length > 0) {
      throw new Error(`Still pending after repair: ${remaining.join(", ")}`)
    }

    console.log("\nPending migrations repaired and recorded. pnpm db:migrate should now be a no-op.")
  } finally {
    await sql.end({ timeout: 5 })
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
