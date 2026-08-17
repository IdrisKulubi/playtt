import { readFileSync } from "node:fs"
import { join } from "node:path"
import postgres from "postgres"

import { applyCanonicalMigrations } from "./lib/replay-migrations.mjs"
import { validateTenantBackfill } from "./validate-tenant-backfill.mjs"

const root = process.cwd()

function getDatabaseUrl() {
  const url = process.env.POSTGRES_URL?.replace(/^['"]+|['"]+$/g, "").trim()
  if (!url) {
    throw new Error("POSTGRES_URL is required.")
  }
  return url
}

const EXPECTED_TABLES = [
  "tenants",
  "brands",
  "tenant_memberships",
  "locations",
  "zones",
  "resource_types",
  "resources",
  "resource_capabilities",
  "feature_flags",
  "audit_logs",
  "bookings",
  "booking_modifications",
  "booking_status_history",
  "payments",
  "access_credentials",
  "session_events",
  "matches",
  "replays",
  "notifications",
  "hardware_configs",
  "booking_credit_balances",
  "booking_credit_ledger",
  "replay_credit_balances",
  "replay_credit_ledger",
  "product_payments",
  "coach_subscriptions",
  "coach_insights",
  "coach_training_items",
  "user",
  "session",
  "account",
  "verification",
  "two_factor",
]

async function main() {
  const sql = postgres(getDatabaseUrl(), { max: 1 })
  const skipMigrate = process.argv.includes("--skip-migrate")

  try {
    if (!skipMigrate) {
      const applied = await applyCanonicalMigrations(sql, join(root, "drizzle"))
      console.log(`Migrations: ${applied.length} files in lineage`)
    }

    if (!skipMigrate) {
      const seed = readFileSync(join(root, "db", "seed-phase1.sql"), "utf8")
      const backfill = readFileSync(join(root, "db", "backfill-tenant-scope.sql"), "utf8")
      await sql.unsafe(seed)
      await sql.unsafe(backfill)
      console.log("Seed + backfill: complete")
    }

    const migrations = await sql`
      select id, hash, created_at
      from drizzle.__drizzle_migrations
      order by created_at
    `
    console.log(`\nApplied migrations (${migrations.length}):`)
    for (const row of migrations) {
      console.log(`  ${row.id}`)
    }

    const pgTenantConstraints = await sql`
      select conname
      from pg_constraint
      where conname like '%tenant%'
      order by conname
    `
    console.log(`\npg_constraint tenant names (${pgTenantConstraints.length}):`)
    for (const row of pgTenantConstraints) {
      console.log(`  ${row.conname}`)
    }

    const failures = await validateTenantBackfill(sql)
    if (failures.length > 0) {
      console.error("Tenant backfill validation FAILED:")
      for (const failure of failures) {
        console.error(`  - ${failure}`)
      }
      process.exitCode = 1
    } else {
      console.log("Tenant backfill validation: PASS")
    }

    const tables = await sql`
      select table_name
      from information_schema.tables
      where table_schema = 'public' and table_type = 'BASE TABLE'
      order by table_name
    `

    console.log(`\nPublic tables (${tables.length}):`)
    console.log(tables.map((t) => t.table_name).join(", "))

    const have = new Set(tables.map((t) => t.table_name))
    const missing = EXPECTED_TABLES.filter((name) => !have.has(name))
    const extra = [...have].filter(
      (name) => !EXPECTED_TABLES.includes(name) && !name.startsWith("__"),
    )

    console.log("\nExpected tenancy/catalog tables missing:", missing.length ? missing.join(", ") : "none")
    console.log("Extra tables:", extra.length ? extra.join(", ") : "none")

    const tenantCols = await sql`
      select table_name, is_nullable, column_default is not null as has_default
      from information_schema.columns
      where table_schema = 'public' and column_name = 'tenant_id'
      order by table_name
    `

    console.log("\ntenant_id columns:")
    for (const row of tenantCols) {
      console.log(
        `  ${row.table_name}: nullable=${row.is_nullable} default=${row.has_default}`,
      )
    }

    const fks = await sql`
      select
        tc.table_name as child_table,
        kcu.column_name as child_column,
        ccu.table_name as parent_table,
        ccu.column_name as parent_column,
        tc.constraint_name
      from information_schema.table_constraints tc
      join information_schema.key_column_usage kcu
        on tc.constraint_name = kcu.constraint_name
        and tc.table_schema = kcu.table_schema
      join information_schema.constraint_column_usage ccu
        on ccu.constraint_name = tc.constraint_name
        and ccu.table_schema = tc.table_schema
      where tc.constraint_type = 'FOREIGN KEY'
        and tc.table_schema = 'public'
        and tc.constraint_name like '%tenant%'
      order by tc.table_name, tc.constraint_name, kcu.ordinal_position
    `

    console.log(`\nTenant-related FK constraints (${fks.length}):`)
    for (const fk of fks) {
      console.log(
        `  ${fk.child_table}.${fk.child_column} -> ${fk.parent_table}.${fk.parent_column} [${fk.constraint_name}]`,
      )
    }

    const compositeNames = [
      "bookings_tenant_location_fk",
      "bookings_tenant_resource_fk",
      "payments_tenant_booking_fk",
      "booking_modifications_tenant_booking_fk",
      "hardware_configs_tenant_location_fk",
    ]
    const presentComposite = compositeNames.filter((name) =>
      fks.some((fk) => fk.constraint_name === name),
    )
    console.log("\nComposite tenant FKs:", presentComposite.join(", "))

    const catalog = await sql`
      select
        l.id as venue_id,
        l.tenant_id,
        l.slug as venue_slug,
        z.slug as zone_slug,
        rt.code as resource_type,
        r.code as resource_code,
        r.ruleset,
        r.type as legacy_type
      from locations l
      left join zones z on z.location_id = l.id
      left join resources r on r.location_id = l.id
      left join resource_types rt on r.resource_type_id = rt.id
      where l.slug = 'playtt-hurlingham'
    `

    console.log("\nHurlingham catalog:")
    console.log(JSON.stringify(catalog[0], null, 2))

    const [{ c: capabilityCount }] = await sql`
      select count(*)::int as c from resource_capabilities
    `
    console.log(`Resource capabilities: ${capabilityCount}`)
  } finally {
    await sql.end({ timeout: 5 })
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
