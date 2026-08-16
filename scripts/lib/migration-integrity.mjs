import { createHash } from "node:crypto"
import { existsSync, readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"

const SQL_FILE_PATTERN = /^(\d{4})_(.+)\.sql$/
const SNAPSHOT_FILE_PATTERN = /^(\d{4})_snapshot\.json$/

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"))
}

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex")
}

function finding(code, subject, message, category = "metadata") {
  return {
    code,
    subject,
    message,
    category,
    key: `${code}:${subject}`,
  }
}

function listFiles(directory, pattern) {
  if (!existsSync(directory)) {
    return []
  }

  return readdirSync(directory)
    .filter((file) => pattern.test(file))
    .sort()
}

export function validateMigrationRepository(rootDirectory) {
  const drizzleDirectory = join(rootDirectory, "drizzle")
  const metaDirectory = join(drizzleDirectory, "meta")
  const journalPath = join(metaDirectory, "_journal.json")
  const manifestPath = join(drizzleDirectory, "migration-integrity.json")
  const findings = []

  if (!existsSync(journalPath)) {
    findings.push(
      finding(
        "JOURNAL_MISSING",
        "drizzle/meta/_journal.json",
        "Drizzle migration journal is missing.",
        "integrity"
      )
    )
    return { findings, manifest: null }
  }

  if (!existsSync(manifestPath)) {
    findings.push(
      finding(
        "INTEGRITY_MANIFEST_MISSING",
        "drizzle/migration-integrity.json",
        "Migration integrity manifest is missing.",
        "integrity"
      )
    )
    return { findings, manifest: null }
  }

  const journal = readJson(journalPath)
  const manifest = readJson(manifestPath)
  const sqlFiles = listFiles(drizzleDirectory, SQL_FILE_PATTERN)
  const snapshotFiles = listFiles(metaDirectory, SNAPSHOT_FILE_PATTERN)
  const sqlByTag = new Map(
    sqlFiles.map((file) => [file.replace(/\.sql$/, ""), file])
  )
  const journalEntries = Array.isArray(journal.entries) ? journal.entries : []
  const journalTags = new Set(journalEntries.map((entry) => entry.tag))
  const snapshotByIndex = new Map(
    snapshotFiles.map((file) => [Number(file.slice(0, 4)), file])
  )

  journalEntries.forEach((entry, position) => {
    if (entry.idx !== position) {
      findings.push(
        finding(
          "JOURNAL_INDEX_GAP",
          entry.tag ?? `position-${position}`,
          `Journal entry at position ${position} has idx ${entry.idx}.`,
          "integrity"
        )
      )
    }

    if (!sqlByTag.has(entry.tag)) {
      findings.push(
        finding(
          "JOURNAL_SQL_MISSING",
          entry.tag,
          `Journal entry ${entry.tag} has no matching SQL file.`,
          "integrity"
        )
      )
    }

    if (!snapshotByIndex.has(entry.idx)) {
      findings.push(
        finding(
          "JOURNAL_SNAPSHOT_MISSING",
          entry.tag,
          `Journal entry ${entry.tag} has no ${String(entry.idx).padStart(4, "0")}_snapshot.json.`
        )
      )
    }

    const match = entry.tag?.match(/^(\d{4})_/)
    if (!match || Number(match[1]) !== entry.idx) {
      findings.push(
        finding(
          "JOURNAL_TAG_INDEX_MISMATCH",
          entry.tag ?? `position-${position}`,
          "Journal tag prefix does not match its idx.",
          "integrity"
        )
      )
    }
  })

  for (const tag of sqlByTag.keys()) {
    if (!journalTags.has(tag)) {
      findings.push(
        finding(
          "SQL_NOT_IN_JOURNAL",
          tag,
          `Migration ${tag}.sql is not registered in the Drizzle journal.`
        )
      )
    }
  }

  const migrationManifest = manifest.migrations ?? {}

  for (const [tag, file] of sqlByTag) {
    const expected = migrationManifest[tag]
    if (!expected) {
      findings.push(
        finding(
          "SQL_NOT_IN_INTEGRITY_MANIFEST",
          tag,
          `Migration ${tag}.sql has no recorded digest.`,
          "integrity"
        )
      )
      continue
    }

    const actualHash = sha256(join(drizzleDirectory, file))
    if (actualHash !== expected.sha256) {
      findings.push(
        finding(
          "MIGRATION_HASH_MISMATCH",
          tag,
          `Migration ${tag}.sql changed after its digest was recorded.`,
          "integrity"
        )
      )
    }
  }

  for (const tag of Object.keys(migrationManifest)) {
    if (!sqlByTag.has(tag)) {
      findings.push(
        finding(
          "MANIFEST_SQL_MISSING",
          tag,
          `Integrity manifest references missing migration ${tag}.sql.`,
          "integrity"
        )
      )
    }
  }

  let previousSnapshot = null
  for (const file of snapshotFiles) {
    const index = Number(file.slice(0, 4))
    if (!journalEntries.some((entry) => entry.idx === index)) {
      findings.push(
        finding(
          "SNAPSHOT_NOT_IN_JOURNAL",
          file,
          `${file} has no matching journal entry.`,
          "integrity"
        )
      )
    }

    const snapshot = readJson(join(metaDirectory, file))
    if (previousSnapshot && snapshot.prevId !== previousSnapshot.id) {
      findings.push(
        finding(
          "SNAPSHOT_CHAIN_BROKEN",
          file,
          `${file} does not reference the preceding snapshot id.`,
          "integrity"
        )
      )
    }
    previousSnapshot = snapshot
  }

  for (const customSql of manifest.requiredCustomSql ?? []) {
    const migrationFile = sqlByTag.get(customSql.migration)
    if (!migrationFile) {
      findings.push(
        finding(
          "CUSTOM_SQL_MIGRATION_MISSING",
          customSql.name,
          `Required custom SQL ${customSql.name} references a missing migration.`,
          "integrity"
        )
      )
      continue
    }

    const sql = readFileSync(join(drizzleDirectory, migrationFile), "utf8")
    for (const pattern of customSql.patterns ?? []) {
      if (!new RegExp(pattern, "ims").test(sql)) {
        findings.push(
          finding(
            "CUSTOM_SQL_MISSING",
            customSql.name,
            `Required custom SQL ${customSql.name} is missing pattern: ${pattern}`,
            "integrity"
          )
        )
      }
    }
  }

  return { findings, manifest }
}

export function classifyFindings(result, { strict = false } = {}) {
  const acknowledgedKeys = new Set(
    result.manifest?.acknowledgedMetadataDrift ?? []
  )
  const acknowledged = result.findings.filter(
    (item) => item.category === "metadata" && acknowledgedKeys.has(item.key)
  )
  const unexpected = result.findings.filter(
    (item) => item.category !== "metadata" || !acknowledgedKeys.has(item.key)
  )
  const currentMetadataKeys = new Set(
    result.findings
      .filter((item) => item.category === "metadata")
      .map((item) => item.key)
  )
  const staleAcknowledgements = [...acknowledgedKeys]
    .filter((key) => !currentMetadataKeys.has(key))
    .map((key) =>
      finding(
        "STALE_ACKNOWLEDGEMENT",
        key,
        `Acknowledged migration drift no longer exists: ${key}`,
        "integrity"
      )
    )

  return {
    acknowledged,
    blocking: strict
      ? [...result.findings, ...staleAcknowledgements]
      : [...unexpected, ...staleAcknowledgements],
  }
}
