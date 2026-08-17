import { readFileSync } from "node:fs"
import { join } from "node:path"

import { collectSchemaFingerprint } from "./schema-fingerprint.mjs"
import {
  applyMigrationFiles,
  listMigrationSqlFiles,
} from "./replay-migrations.mjs"
import { resetPublicSchema } from "./reset-public-schema.mjs"

export const PHASE2_MIGRATION_FILES = [
  "0012_payment_webhook_inbox.sql",
  "0013_outbox_events.sql",
  "0014_play_sessions.sql",
]

export const PHASE1_MIGRATION_FILES = [
  "0000_curvy_hiroim.sql",
  "0001_user_onboarding.sql",
  "0002_booking_edits.sql",
  "0003_coach_replay_credits.sql",
  "0004_booking_credit_ledger.sql",
  "0005_phase0_idempotency.sql",
  "0006_tenancy_foundation.sql",
  "0007_venue_resource_catalog.sql",
  "0008_tenant_scope_expand.sql",
  "0009_tenant_scope_enforce.sql",
  "0010_tenant_composite_fks.sql",
  "0011_access_points.sql",
]

export function readSeedSql(rootDirectory) {
  return readFileSync(join(rootDirectory, "db", "seed-phase1.sql"), "utf8")
}

export function readTenantBackfillSql(rootDirectory) {
  return readFileSync(join(rootDirectory, "db", "backfill-tenant-scope.sql"), "utf8")
}

export function readPlaySessionBackfillSql(rootDirectory) {
  return readFileSync(join(rootDirectory, "db", "backfill-play-sessions.sql"), "utf8")
}

export function readConfirmationEmailBackfillSql(rootDirectory) {
  return readFileSync(
    join(rootDirectory, "db", "backfill-confirmation-email-sent.sql"),
    "utf8",
  )
}

export function migrationFilesUpToPhase1(drizzleDirectory) {
  const files = listMigrationSqlFiles(drizzleDirectory)
  const available = new Set(files)
  for (const file of PHASE1_MIGRATION_FILES) {
    if (!available.has(file)) {
      throw new Error(`Missing required Phase 1 migration: ${file}`)
    }
  }
  return [...PHASE1_MIGRATION_FILES]
}

export function migrationFilesAfterPhase2(drizzleDirectory) {
  const phase1And2 = new Set([
    ...PHASE1_MIGRATION_FILES,
    ...PHASE2_MIGRATION_FILES,
  ])
  return listMigrationSqlFiles(drizzleDirectory).filter(
    (file) => !phase1And2.has(file),
  )
}

export async function runSeedAndTenantBackfill(sql, rootDirectory) {
  await sql.unsafe(readSeedSql(rootDirectory))
  await sql.unsafe(readTenantBackfillSql(rootDirectory))
}

export async function runPhase2Backfills(sql, rootDirectory) {
  await sql.unsafe(readPlaySessionBackfillSql(rootDirectory))
  await sql.unsafe(readConfirmationEmailBackfillSql(rootDirectory))
}

export async function replayEmptyLineage(sql, rootDirectory, drizzleDirectory) {
  const appliedFiles = listMigrationSqlFiles(drizzleDirectory)
  await applyMigrationFiles(sql, drizzleDirectory, appliedFiles)
  await runSeedAndTenantBackfill(sql, rootDirectory)
  const fingerprint = await collectSchemaFingerprint(sql)
  return { appliedFiles, fingerprint }
}

export async function replayPhase1CloneLineage(
  sql,
  rootDirectory,
  drizzleDirectory,
) {
  const phase1Files = migrationFilesUpToPhase1(drizzleDirectory)
  await applyMigrationFiles(sql, drizzleDirectory, phase1Files)
  await runSeedAndTenantBackfill(sql, rootDirectory)
  await applyMigrationFiles(sql, drizzleDirectory, PHASE2_MIGRATION_FILES)
  await runPhase2Backfills(sql, rootDirectory)
  const laterFiles = migrationFilesAfterPhase2(drizzleDirectory)
  await applyMigrationFiles(sql, drizzleDirectory, laterFiles)
  const fingerprint = await collectSchemaFingerprint(sql)
  return {
    appliedFiles: [...phase1Files, ...PHASE2_MIGRATION_FILES, ...laterFiles],
    fingerprint,
  }
}

export async function assertPhase2CloneMatchesEmptyReplay(
  sql,
  rootDirectory,
  drizzleDirectory,
) {
  await resetPublicSchema(sql)
  const empty = await replayEmptyLineage(sql, rootDirectory, drizzleDirectory)

  await resetPublicSchema(sql)
  const clone = await replayPhase1CloneLineage(sql, rootDirectory, drizzleDirectory)

  if (empty.fingerprint.digest !== clone.fingerprint.digest) {
    throw new Error(
      `Phase 2 clone fingerprint mismatch.\nempty=${empty.fingerprint.digest}\nclone=${clone.fingerprint.digest}`,
    )
  }

  return {
    digest: empty.fingerprint.digest,
    emptyFiles: empty.appliedFiles.length,
    cloneFiles: clone.appliedFiles.length,
  }
}
