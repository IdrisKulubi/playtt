import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"

import {
  canAccessAdminShell,
  canManageAdminPlatform,
} from "../admin/access.mjs"
import { canPerformTenantAction } from "../tenancy/permissions-core.mjs"

const repoRoot = join(import.meta.dirname, "..", "..", "..")

test("canAccessAdminShell requires analytics.read", () => {
  assert.equal(canAccessAdminShell("customer"), false)
  assert.equal(canAccessAdminShell("support"), false)
  assert.equal(canAccessAdminShell("operator"), true)
  assert.equal(canAccessAdminShell("owner"), true)
})

test("canManageAdminPlatform is owner-only", () => {
  assert.equal(canManageAdminPlatform("operator"), false)
  assert.equal(canManageAdminPlatform("owner"), true)
})

test("owner has analytics.read and membership.manage", () => {
  assert.equal(canPerformTenantAction("owner", "analytics.read"), true)
  assert.equal(canPerformTenantAction("owner", "membership.manage"), true)
  assert.equal(canPerformTenantAction("operator", "membership.manage"), false)
  assert.equal(canPerformTenantAction("operator", "analytics.read"), true)
})

test("admin shell links to /admin routes", () => {
  const source = readFileSync(
    join(repoRoot, "src", "components", "admin", "admin-shell.tsx"),
    "utf8",
  )

  assert.match(source, /\/admin\/bookings/)
  assert.match(source, /\/admin\/revenue/)
  assert.match(source, /\/admin\/members/)
  assert.match(source, /\/admin\/vendors/)
})

test("operator routes redirect to admin", () => {
  const operatorPage = readFileSync(
    join(repoRoot, "src", "app", "operator", "page.tsx"),
    "utf8",
  )
  assert.match(operatorPage, /redirect\("\/admin"\)/)
})

test("catalog venue writes use audit logs", () => {
  const source = readFileSync(
    join(repoRoot, "src", "server", "catalog", "venues-service.ts"),
    "utf8",
  )

  assert.match(source, /writeAuditLog/)
  assert.match(source, /catalog\.venue\.create/)
  assert.match(source, /authorize\(context, "catalog\.manage"\)/)
})

test("seed runner promotes PLAYTT_ADMIN_EMAIL when configured", () => {
  const source = readFileSync(
    join(repoRoot, "scripts", "run-seed-phase1.mjs"),
    "utf8",
  )

  assert.match(source, /PLAYTT_ADMIN_EMAIL/)
  assert.match(source, /role = 'owner'/)
})
