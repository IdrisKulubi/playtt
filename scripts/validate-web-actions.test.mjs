import assert from "node:assert/strict"
import test from "node:test"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import { validateWebActionContracts } from "./lib/web-actions-contracts.mjs"

test("current web action contracts validate", () => {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
  const result = validateWebActionContracts(root)

  assert.deepEqual(result.findings, [])
  assert.ok(result.actionCount >= 6)
  assert.ok(result.fixtureCount >= 10)
})
