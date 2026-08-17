import { readFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import postgres from "postgres"

import { collectSchemaFingerprint } from "./lib/schema-fingerprint.mjs"
import { applyCanonicalMigrations } from "./lib/replay-migrations.mjs"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const drizzleDirectory = join(root, "drizzle")

function readSeedSql() {
  return readFileSync(join(root, "db", "seed-phase1.sql"), "utf8")
}

function readBackfillSql() {
  return readFileSync(join(root, "db", "backfill-tenant-scope.sql"), "utf8")
}

async function runSeed(sql) {
  await sql.unsafe(readSeedSql())
  await sql.unsafe(readBackfillSql())
}

async function main() {
  const databaseUrl = process.env.POSTGRES_URL?.replace(/^['"]+|['"]+$/g, "").trim()

  if (!databaseUrl) {
    console.error("POSTGRES_URL is required for replay-drizzle-lineage.")
    process.exit(1)
  }

  const sql = postgres(databaseUrl, { max: 1 })

  try {
    const appliedFiles = await applyCanonicalMigrations(sql, drizzleDirectory)
    const fingerprintAfterMigrations = await collectSchemaFingerprint(sql)

    await runSeed(sql)
    await runSeed(sql)

    const fingerprintAfterSeed = await collectSchemaFingerprint(sql)

    if (fingerprintAfterMigrations.digest !== fingerprintAfterSeed.digest) {
      throw new Error("Schema fingerprint changed after idempotent seed replay.")
    }

    console.log(
      JSON.stringify(
        {
          appliedFiles,
          fingerprint: fingerprintAfterMigrations.digest,
          seedIdempotent: true,
        },
        null,
        2,
      ),
    )
  } finally {
    await sql.end({ timeout: 5 })
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
