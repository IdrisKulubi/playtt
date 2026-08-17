import { readFileSync } from "node:fs"
import { join } from "node:path"
import assert from "node:assert/strict"
import test from "node:test"

import { rejectClientTenantId } from "../tenancy/membership-context.mjs"
import { PLAYTT_TENANT_ID } from "../tenancy/constants.ts"
import { TenancyError } from "../tenancy/errors.ts"

const serverRoot = join(import.meta.dirname, "..")

const tenantScopedRepositories = [
  ["bookings", "repository.ts"],
  ["bookings/modifications", "repository.ts"],
  ["payments", "repository.ts"],
  ["coach", "repository.ts"],
  ["replays", "repository.ts"],
]

test("tenant-owned repositories filter by context.tenantId", () => {
  for (const [folder, fileName] of tenantScopedRepositories) {
    const source = readFileSync(join(serverRoot, folder, fileName), "utf8")
    assert.match(
      source,
      /context\.tenantId/,
      `${folder}/${fileName} should scope queries by tenant context`,
    )
    assert.match(
      source,
      /eq\([a-zA-Z]+\.tenantId, context\.tenantId\)/,
      `${folder}/${fileName} should include tenant_id predicates`,
    )
  }
})

test("booking http mapper returns 401 and 403 for tenancy failures", () => {
  const source = readFileSync(
    join(serverRoot, "bookings", "http.ts"),
    "utf8",
  )
  assert.match(source, /NOT_AUTHENTICATED/)
  assert.match(source, /status: 401/)
  assert.match(source, /FORBIDDEN_ACTION/)
  assert.match(source, /status: 403/)
})

test("client-supplied tenant identifiers are rejected before membership resolution", () => {
  assert.throws(() => rejectClientTenantId(PLAYTT_TENANT_ID), TenancyError)
})
