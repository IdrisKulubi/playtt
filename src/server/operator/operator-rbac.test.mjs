import { readFileSync } from "node:fs"
import { join } from "node:path"
import assert from "node:assert/strict"
import test from "node:test"

const operatorRoot = join(import.meta.dirname)

test("operator repository scopes queries by tenant context", () => {
  const source = readFileSync(join(operatorRoot, "repository.ts"), "utf8")
  assert.match(source, /eq\([a-zA-Z]+\.tenantId, context\.tenantId\)/)
})

test("operator API routes resolve tenant headers through authenticated membership", () => {
  const catalogRoute = readFileSync(
    join(import.meta.dirname, "../../app/api/operator/catalog/route.ts"),
    "utf8",
  )
  assert.match(catalogRoute, /resolveTenantContextForSessionUser/)
  assert.match(catalogRoute, /x-tenant-id/)
  assert.match(catalogRoute, /canAccessOperatorShell/)
  assert.match(catalogRoute, /isOperatorShellEnabledForTenant/)

  const membershipResolver = readFileSync(
    join(operatorRoot, "../tenancy/resolve-membership.ts"),
    "utf8",
  )
  assert.match(membershipResolver, /eq\(tenantMemberships\.userId, input\.userId\)/)
  assert.match(membershipResolver, /eq\(tenantMemberships\.tenantId, tenantId\)/)
  assert.match(membershipResolver, /eq\(tenantMemberships\.status, "active"\)/)
})
