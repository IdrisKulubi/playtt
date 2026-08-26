#!/usr/bin/env node
import { readFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import postgres from "postgres"

import {
  ACCESS_CREDENTIAL_COLUMNS,
  NOTIFICATION_COLUMNS,
  PHASE5_CONSTRAINTS,
  PHASE5_ENUM_ADDITIONS,
  PHASE5_INDEXES,
  PHASE5_MIGRATION_FILES,
  PHASE5_TABLES,
  PHASE5_TYPES,
  SKIPPABLE_PG_CODES,
  parseMigrationStatements,
  orderMigrationStatements,
  shouldSkipMigrationStatement,
} from "./lib/phase5-schema-expectations.mjs"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const args = new Set(process.argv.slice(2))
const shouldFix = args.has("--fix")
const purgeUnmappable = args.has("--purge-unmappable-legacy")

function requireDatabaseUrl() {
  const databaseUrl = process.env.POSTGRES_URL?.replace(/^['"]+|['"]+$/g, "").trim()
  if (!databaseUrl) {
    throw new Error(
      "POSTGRES_URL is required. Run with: node --env-file=.env.local scripts/repair-phase5-schema.mjs",
    )
  }
  return databaseUrl
}

function logIssue(kind, name, message) {
  return { kind, name, message }
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

async function columnExists(sql, tableName, columnName) {
  const [row] = await sql`
    select 1 as ok
    from information_schema.columns
    where table_schema = 'public'
      and table_name = ${tableName}
      and column_name = ${columnName}
    limit 1
  `
  return Boolean(row)
}

async function typeExists(sql, typeName) {
  const [row] = await sql`
    select 1 as ok
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = ${typeName}
    limit 1
  `
  return Boolean(row)
}

async function enumLabelExists(sql, typeName, label) {
  const [row] = await sql`
    select 1 as ok
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = ${typeName} and e.enumlabel = ${label}
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

async function indexExists(sql, name) {
  const [row] = await sql`
    select 1 as ok
    from pg_indexes
    where schemaname = 'public' and indexname = ${name}
    limit 1
  `
  return Boolean(row)
}

async function inspectPhase5Schema(sql) {
  const issues = []

  for (const typeName of PHASE5_TYPES) {
    if (!(await typeExists(sql, typeName))) {
      issues.push(logIssue("type", typeName, "enum type is missing"))
    }
  }

  for (const addition of PHASE5_ENUM_ADDITIONS) {
    if (!(await enumLabelExists(sql, addition.type, addition.value))) {
      issues.push(
        logIssue(
          "enum_value",
          `${addition.type}.${addition.value}`,
          "enum label is missing",
        ),
      )
    }
  }

  for (const tableName of PHASE5_TABLES) {
    if (!(await tableExists(sql, tableName))) {
      issues.push(logIssue("table", tableName, "table is missing"))
    }
  }

  if (await tableExists(sql, "access_credentials")) {
    for (const columnName of ACCESS_CREDENTIAL_COLUMNS) {
      if (!(await columnExists(sql, "access_credentials", columnName))) {
        issues.push(
          logIssue("column", `access_credentials.${columnName}`, "column is missing"),
        )
      }
    }
    if (await columnExists(sql, "access_credentials", "access_code")) {
      issues.push(
        logIssue(
          "column",
          "access_credentials.access_code",
          "legacy plaintext column still exists",
        ),
      )
    }
  }

  if (await tableExists(sql, "notifications")) {
    for (const columnName of NOTIFICATION_COLUMNS) {
      if (!(await columnExists(sql, "notifications", columnName))) {
        issues.push(
          logIssue("column", `notifications.${columnName}`, "column is missing"),
        )
      }
    }
  }

  for (const name of PHASE5_CONSTRAINTS) {
    if (!(await constraintExists(sql, name))) {
      issues.push(logIssue("constraint", name, "constraint is missing"))
    }
  }

  for (const name of PHASE5_INDEXES) {
    if (!(await indexExists(sql, name))) {
      issues.push(logIssue("index", name, "index is missing"))
    }
  }

  if (await tableExists(sql, "access_credentials")) {
    const [unmappable] = await sql`
      select count(*)::int as count
      from access_credentials
      where grant_id is null
         or access_point_id is null
         or lock_device_id is null
         or stable_name is null
    `
    if (unmappable.count > 0) {
      issues.push(
        logIssue(
          "data",
          "access_credentials.unmappable",
          `${unmappable.count} credential row(s) still missing grant/access-point/lock/stable_name`,
        ),
      )
    }
  }

  return issues
}

async function ensureEnumValue(sql, addition) {
  const exists = await enumLabelExists(sql, addition.type, addition.value)
  if (exists) return

  if (addition.before) {
    await sql.unsafe(
      `ALTER TYPE "public"."${addition.type}" ADD VALUE '${addition.value}' BEFORE '${addition.before}'`,
    )
    return
  }

  await sql.unsafe(
    `ALTER TYPE "public"."${addition.type}" ADD VALUE IF NOT EXISTS '${addition.value}'`,
  )
}

async function backfillLegacyAccessCredentials(sql) {
  if (!(await tableExists(sql, "access_credentials"))) return
  if (!(await tableExists(sql, "access_grants"))) return

  await sql.unsafe(`
    INSERT INTO "access_grants" (
      "tenant_id", "booking_id", "play_session_id", "owner_user_id", "location_id", "resource_id",
      "encrypted_code", "encryption_key_version", "code_fingerprint", "valid_from", "valid_until",
      "status", "correlation_id", "failed_at"
    )
    SELECT
      ac."tenant_id", ac."booking_id", min(ac."play_session_id"::text)::uuid, b."user_id", b."location_id", b."resource_id",
      'legacy-credential-unavailable', 'legacy', 'legacy:' || ac."booking_id"::text,
      min(ac."valid_from"), max(ac."valid_until"), 'action_required',
      'phase5-legacy:' || ac."booking_id"::text, now()
    FROM "access_credentials" ac
    JOIN "bookings" b ON b."tenant_id" = ac."tenant_id" AND b."id" = ac."booking_id"
    WHERE ac."grant_id" IS NULL
      AND NOT EXISTS (
        SELECT 1
        FROM "access_grants" existing
        WHERE existing."tenant_id" = ac."tenant_id"
          AND existing."booking_id" = ac."booking_id"
      )
    GROUP BY ac."tenant_id", ac."booking_id", b."user_id", b."location_id", b."resource_id"
  `)

  await sql.unsafe(`
    UPDATE "access_credentials" ac
    SET
      "grant_id" = ag."id",
      "access_point_id" = point."id",
      "lock_device_id" = lock_assignment."device_id",
      "stable_name" = coalesce(ac."stable_name", 'playtt:' || ag."id"::text || ':' || ac."id"::text),
      "status" = coalesce(ac."status", 'failed'),
      "provider_error_category" = coalesce(ac."provider_error_category", 'configuration_terminal'),
      "provider_error_code" = coalesce(ac."provider_error_code", 'LEGACY_CREDENTIAL_REQUIRES_REPROVISION')
    FROM "access_grants" ag
    LEFT JOIN LATERAL (
      SELECT ap."id"
      FROM "access_point_resources" apr
      JOIN "access_points" ap ON ap."tenant_id" = apr."tenant_id" AND ap."id" = apr."access_point_id"
      WHERE apr."tenant_id" = ag."tenant_id" AND apr."resource_id" = ag."resource_id" AND ap."is_active"
      ORDER BY apr."sort_order", ap."sort_order", ap."id"
      LIMIT 1
    ) point ON true
    LEFT JOIN LATERAL (
      SELECT da."device_id"
      FROM "device_assignments" da
      WHERE da."tenant_id" = ag."tenant_id" AND da."location_id" = ag."location_id"
        AND da."role" = 'lock' AND da."effective_to" IS NULL
        AND (da."resource_id" = ag."resource_id" OR da."resource_id" IS NULL)
      ORDER BY (da."resource_id" IS NOT NULL) DESC, da."effective_from" DESC, da."id"
      LIMIT 1
    ) lock_assignment ON true
    WHERE ag."tenant_id" = ac."tenant_id"
      AND ag."booking_id" = ac."booking_id"
      AND (
        ac."grant_id" IS NULL
        OR ac."access_point_id" IS NULL
        OR ac."lock_device_id" IS NULL
        OR ac."stable_name" IS NULL
      )
  `)
}

async function purgeUnmappableLegacyCredentials(sql) {
  const deleted = await sql`
    delete from access_credentials
    where grant_id is null
       or access_point_id is null
       or lock_device_id is null
       or stable_name is null
    returning id
  `
  return deleted.length
}

async function runMigrationStatements(sql, fileName) {
  const content = readFileSync(join(root, "drizzle", fileName), "utf8")
  const statements = orderMigrationStatements(parseMigrationStatements(content))
  const results = { applied: 0, skipped: 0, deferred: 0 }

  console.log(`Applying ${fileName} (${statements.length} statements)...`)

  for (const statement of statements) {
    const skipReason = shouldSkipMigrationStatement(statement)
    if (skipReason === "guard") {
      results.deferred += 1
      continue
    }

    try {
      await sql.unsafe(statement)
      results.applied += 1
    } catch (error) {
      if (SKIPPABLE_PG_CODES.has(error?.code)) {
        results.skipped += 1
        continue
      }
      const preview = statement.replace(/\s+/g, " ").slice(0, 120)
      throw new Error(
        `${fileName} failed (${error?.code ?? "unknown"}): ${error?.message}\nStatement: ${preview}`,
      )
    }
  }

  return results
}

function printIssues(issues) {
  const grouped = new Map()
  for (const issue of issues) {
    const bucket = grouped.get(issue.kind) ?? []
    bucket.push(issue)
    grouped.set(issue.kind, bucket)
  }

  for (const [kind, bucket] of grouped) {
    console.log(`\n${kind}:`)
    for (const issue of bucket) {
      console.log(`  - ${issue.name}: ${issue.message}`)
    }
  }
}

async function main() {
  const sql = postgres(requireDatabaseUrl(), { max: 1 })

  try {
    if (shouldFix) {
      console.log("Repairing Phase 5 schema...")
      for (const addition of PHASE5_ENUM_ADDITIONS) {
        try {
          await ensureEnumValue(sql, addition)
        } catch (error) {
          if (error?.code === "42710") continue
          throw error
        }
      }

      for (const fileName of PHASE5_MIGRATION_FILES) {
        const firstPass = await runMigrationStatements(sql, fileName)
        console.log(
          `  ${fileName}: applied=${firstPass.applied} skipped=${firstPass.skipped} deferred=${firstPass.deferred}`,
        )
      }

      await backfillLegacyAccessCredentials(sql)

      if (purgeUnmappable) {
        const removed = await purgeUnmappableLegacyCredentials(sql)
        console.log(`Purged ${removed} unmappable legacy credential row(s).`)
      }

      const [remaining] = await sql`
        select count(*)::int as count
        from access_credentials
        where grant_id is null
           or access_point_id is null
           or lock_device_id is null
           or stable_name is null
      `
      if (remaining.count > 0) {
        console.log(
          `\n${remaining.count} credential row(s) still unmappable. Re-run with --purge-unmappable-legacy on a disposable/dev database, or commission access-point/lock mappings and retry.`,
        )
      } else {
        const notNullStatements = [
          'ALTER TABLE "access_credentials" ALTER COLUMN "grant_id" SET NOT NULL',
          'ALTER TABLE "access_credentials" ALTER COLUMN "access_point_id" SET NOT NULL',
          'ALTER TABLE "access_credentials" ALTER COLUMN "lock_device_id" SET NOT NULL',
          'ALTER TABLE "access_credentials" ALTER COLUMN "stable_name" SET NOT NULL',
        ]
        for (const statement of notNullStatements) {
          try {
            await sql.unsafe(statement)
          } catch (error) {
            if (!SKIPPABLE_PG_CODES.has(error?.code)) throw error
          }
        }

        if (await columnExists(sql, "access_credentials", "access_code")) {
          try {
            await sql.unsafe('ALTER TABLE "access_credentials" DROP COLUMN "access_code"')
          } catch (error) {
            if (!SKIPPABLE_PG_CODES.has(error?.code)) throw error
          }
        }

        for (const fileName of PHASE5_MIGRATION_FILES) {
          const secondPass = await runMigrationStatements(sql, fileName)
          console.log(
            `  retry ${fileName}: applied=${secondPass.applied} skipped=${secondPass.skipped} deferred=${secondPass.deferred}`,
          )
        }
      }
    }

    const issues = await inspectPhase5Schema(sql)
    if (issues.length === 0) {
      console.log("\nPhase 5 schema looks complete.")
      return
    }

    console.log(`\nFound ${issues.length} Phase 5 schema issue(s):`)
    printIssues(issues)

    if (!shouldFix) {
      console.log("\nRe-run with --fix to apply idempotent repairs.")
      console.log(
        "If legacy preview credentials block NOT NULL enforcement, add --purge-unmappable-legacy on dev only.",
      )
      process.exitCode = 1
      return
    }

    process.exitCode = 1
  } finally {
    await sql.end({ timeout: 5 })
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
