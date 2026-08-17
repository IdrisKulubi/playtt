import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { after, before, test } from "node:test"

import {
  createDisposableMigrationHarness,
  hasIntegrationDatabase,
  listCanonicalMigrationTags,
} from "../lib/disposable-migration-harness.mjs"
import { PHASE2_MIGRATION_FILES } from "../lib/phase2-replay.mjs"
import { validateMigrationRepository } from "../lib/migration-integrity.mjs"

const repoRoot = join(import.meta.dirname, "..", "..")

let harness

before(async () => {
  if (!hasIntegrationDatabase()) {
    return
  }

  harness = await createDisposableMigrationHarness()
})

after(async () => {
  await harness?.teardown()
})

test("phase 2 migrations are journaled and integrity-pinned", () => {
  const journal = JSON.parse(
    readFileSync(join(repoRoot, "drizzle", "meta", "_journal.json"), "utf8"),
  )
  const integrity = JSON.parse(
    readFileSync(join(repoRoot, "drizzle", "migration-integrity.json"), "utf8"),
  )

  for (const file of PHASE2_MIGRATION_FILES) {
    const tag = file.replace(/\.sql$/, "")
    assert.ok(
      journal.entries.some((entry) => entry.tag === tag),
      `missing journal entry for ${tag}`,
    )
    assert.ok(
      integrity.migrations?.[tag]?.sha256,
      `missing integrity hash for ${tag}`,
    )
  }

  const validation = validateMigrationRepository(repoRoot)
  assert.equal(validation.findings.length, 0)
})

test("0011 clone then 0012-0014 matches full empty replay fingerprint", async (t) => {
  if (!hasIntegrationDatabase()) {
    t.skip("PLAYTT_TEST_DATABASE_URL is not configured")
    return
  }

  const empty = await harness.replayEmpty()
  const clone = await harness.replayPhase1Clone()

  assert.equal(empty.fingerprint.digest, clone.fingerprint.digest)
  assert.deepEqual(
    listCanonicalMigrationTags().slice(-3),
    PHASE2_MIGRATION_FILES.map((file) => file.replace(/\.sql$/, "")),
  )
})
