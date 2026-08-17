import { createHash } from "node:crypto"
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import test from "node:test"
import assert from "node:assert/strict"
import { fileURLToPath } from "node:url"

import {
  classifyFindings,
  validateMigrationRepository,
} from "./lib/migration-integrity.mjs"

function digest(value) {
  return createHash("sha256").update(value).digest("hex")
}

function createFixture() {
  const root = mkdtempSync(join(tmpdir(), "playtt-migrations-"))
  const drizzle = join(root, "drizzle")
  const meta = join(drizzle, "meta")
  const sql = "create table example (id uuid primary key);\n"
  mkdirSync(meta, { recursive: true })
  writeFileSync(join(drizzle, "0000_example.sql"), sql)
  writeFileSync(
    join(meta, "_journal.json"),
    JSON.stringify({
      version: "7",
      dialect: "postgresql",
      entries: [
        {
          idx: 0,
          version: "7",
          when: 1,
          tag: "0000_example",
          breakpoints: true,
        },
      ],
    })
  )
  writeFileSync(
    join(meta, "0000_snapshot.json"),
    JSON.stringify({
      id: "11111111-1111-1111-1111-111111111111",
      prevId: "00000000-0000-0000-0000-000000000000",
      version: "7",
      dialect: "postgresql",
    })
  )
  writeFileSync(
    join(drizzle, "migration-integrity.json"),
    JSON.stringify({
      version: 1,
      migrations: {
        "0000_example": { sha256: digest(sql) },
      },
      acknowledgedMetadataDrift: [],
      requiredCustomSql: [],
    })
  )
  return root
}

test("current repository matches its explicit migration drift baseline", () => {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
  const result = validateMigrationRepository(root)
  const classified = classifyFindings(result)

  assert.deepEqual(classified.blocking, [])
  assert.deepEqual(classified.acknowledged, [])
})

test("device assignment exclusion constraints are integrity-pinned", () => {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
  const result = validateMigrationRepository(root)
  const names = result.manifest.requiredCustomSql.map((entry) => entry.name)

  assert.ok(names.includes("device_assignments_device_window_excl"))
  assert.ok(names.includes("device_assignments_score_input_window_excl"))
  assert.equal(
    result.findings.some((item) => item.code === "CUSTOM_SQL_MISSING"),
    false,
  )
})

test("detects an unjournaled migration", (context) => {
  const root = createFixture()
  context.after(() => rmSync(root, { recursive: true, force: true }))
  writeFileSync(join(root, "drizzle", "0001_untracked.sql"), "select 1;\n")

  const result = validateMigrationRepository(root)

  assert.ok(
    result.findings.some(
      (item) => item.key === "SQL_NOT_IN_JOURNAL:0001_untracked"
    )
  )
})

test("detects mutation of a recorded migration", (context) => {
  const root = createFixture()
  context.after(() => rmSync(root, { recursive: true, force: true }))
  const migration = join(root, "drizzle", "0000_example.sql")
  writeFileSync(migration, `${readFileSync(migration, "utf8")}select 1;\n`)

  const result = validateMigrationRepository(root)

  assert.ok(
    result.findings.some(
      (item) => item.key === "MIGRATION_HASH_MISMATCH:0000_example"
    )
  )
})

test("detects removal of required custom SQL", (context) => {
  const root = createFixture()
  context.after(() => rmSync(root, { recursive: true, force: true }))
  const manifestPath = join(root, "drizzle", "migration-integrity.json")
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"))
  manifest.requiredCustomSql = [
    {
      name: "example_constraint",
      migration: "0000_example",
      patterns: ["add\\s+constraint\\s+example_constraint"],
    },
  ]
  writeFileSync(manifestPath, JSON.stringify(manifest))

  const result = validateMigrationRepository(root)

  assert.ok(
    result.findings.some(
      (item) => item.key === "CUSTOM_SQL_MISSING:example_constraint"
    )
  )
})
