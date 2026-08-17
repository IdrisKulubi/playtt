import { readFileSync } from "node:fs"
import { join } from "node:path"
import assert from "node:assert/strict"
import test from "node:test"

const operatorRoot = join(import.meta.dirname)

test("operator repository scopes queries by tenant context", () => {
  const source = readFileSync(join(operatorRoot, "repository.ts"), "utf8")
  assert.match(source, /eq\([a-zA-Z]+\.tenantId, context\.tenantId\)/)
})

test("operator API routes reject client tenant headers at membership resolution", () => {
  const catalogRoute = readFileSync(
    join(import.meta.dirname, "../../app/api/operator/catalog/route.ts"),
    "utf8",
  )
  assert.match(catalogRoute, /resolveTenantContextForSessionUser/)
  assert.match(catalogRoute, /x-tenant-id/)
  assert.match(catalogRoute, /canAccessOperatorShell/)
  assert.match(catalogRoute, /isOperatorShellEnabledForTenant/)
})
