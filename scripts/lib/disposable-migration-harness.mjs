import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import postgres from "postgres"

import {
  applyCanonicalMigrations,
  listMigrationSqlFiles,
} from "./replay-migrations.mjs"
import {
  replayEmptyLineage,
  replayPhase1CloneLineage,
  runPhase2Backfills,
  runSeedAndTenantBackfill,
} from "./phase2-replay.mjs"
import { resetPublicSchema } from "./reset-public-schema.mjs"
import {
  createDisposableSchemaName,
  resolveDisposableDatabaseConfig,
} from "./disposable-postgres.mjs"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..")
const drizzleDirectory = join(root, "drizzle")

export { resetPublicSchema } from "./reset-public-schema.mjs"

export async function createDisposableMigrationHarness(
  environment = process.env,
) {
  const { url } = resolveDisposableDatabaseConfig(environment)
  const sql = postgres(url, {
    max: 8,
    connect_timeout: 10,
    idle_timeout: 5,
  })
  let tornDown = false

  await resetPublicSchema(sql)

  return {
    sql,
    root,
    drizzleDirectory,
    runId: createDisposableSchemaName().replace(/^playtt_test_/, "migration_"),
    async applyAllMigrations() {
      return applyCanonicalMigrations(sql, drizzleDirectory)
    },
    async applyAllMigrationsAndSeed() {
      const files = await applyCanonicalMigrations(sql, drizzleDirectory)
      await runSeedAndTenantBackfill(sql, root)
      return files
    },
    async replayEmpty() {
      await resetPublicSchema(sql)
      return replayEmptyLineage(sql, root, drizzleDirectory)
    },
    async replayPhase1Clone() {
      await resetPublicSchema(sql)
      return replayPhase1CloneLineage(sql, root, drizzleDirectory)
    },
    async runPhase2Backfills() {
      await runPhase2Backfills(sql, root)
    },
    async reset() {
      await resetPublicSchema(sql)
    },
    async teardown() {
      if (tornDown) {
        return
      }
      tornDown = true
      try {
        await resetPublicSchema(sql)
      } finally {
        await sql.end({ timeout: 5 })
      }
    },
  }
}

export function hasIntegrationDatabase(environment = process.env) {
  return Boolean(
    environment.PLAYTT_TEST_DATABASE_URL?.trim() &&
      environment.PLAYTT_TEST_DATABASE_CONFIRM ===
        "CREATE_AND_DROP_ISOLATED_PLAYTT_TEST_SCHEMA",
  )
}

export function listCanonicalMigrationTags() {
  return listMigrationSqlFiles(drizzleDirectory).map((file) => file.replace(/\.sql$/, ""))
}
