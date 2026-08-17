import postgres from "postgres"

import {
  TENANT_MISMATCH_CHECKS,
  TENANT_SCOPED_TABLES,
  buildNullTenantCountQuery,
  buildOrphanTenantCountQuery,
} from "../src/server/tenancy/backfill-queries.mjs"

function getDatabaseUrl() {
  const url = process.env.POSTGRES_URL?.replace(/^['"]+|['"]+$/g, "").trim()
  if (!url) {
    throw new Error("POSTGRES_URL is required for validate-tenant-backfill.")
  }
  return url
}

export async function validateTenantBackfill(sql) {
  const failures = []

  for (const tableName of TENANT_SCOPED_TABLES) {
    const [{ count: nullCount }] = await sql.unsafe(buildNullTenantCountQuery(tableName))
    if (nullCount > 0) {
      failures.push(`${tableName} has ${nullCount} row(s) with null tenant_id`)
    }

    const [{ count: orphanCount }] = await sql.unsafe(
      buildOrphanTenantCountQuery(tableName),
    )
    if (orphanCount > 0) {
      failures.push(`${tableName} has ${orphanCount} row(s) with orphan tenant_id`)
    }
  }

  for (const check of TENANT_MISMATCH_CHECKS) {
    const [{ count }] = await sql.unsafe(check.sql)
    if (count > 0) {
      failures.push(`${check.name} found ${count} cross-tenant mismatch row(s)`)
    }
  }

  return failures
}

async function main() {
  const sql = postgres(getDatabaseUrl(), { max: 1 })

  try {
    const failures = await validateTenantBackfill(sql)
    if (failures.length > 0) {
      for (const failure of failures) {
        console.error(`[tenant-backfill] ${failure}`)
      }
      process.exitCode = 1
      return
    }

    console.log("Tenant backfill validation passed.")
  } finally {
    await sql.end({ timeout: 5 })
  }
}

if (import.meta.url === new URL(process.argv[1], "file:").href) {
  main().catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
}
