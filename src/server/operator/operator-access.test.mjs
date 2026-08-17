import assert from "node:assert/strict"
import test from "node:test"

import { canAccessOperatorShell, OPERATOR_SHELL_FLAG_KEY } from "../operator/access.mjs"
import { canPerformTenantAction } from "../tenancy/permissions-core.mjs"

test("canAccessOperatorShell allows support, operator, and owner roles", () => {
  assert.equal(canAccessOperatorShell("support"), true)
  assert.equal(canAccessOperatorShell("operator"), true)
  assert.equal(canAccessOperatorShell("owner"), true)
})

test("canAccessOperatorShell denies customer role", () => {
  assert.equal(canAccessOperatorShell("customer"), false)
})

test("operator shell flag key is stable", () => {
  assert.equal(OPERATOR_SHELL_FLAG_KEY, "operator_shell")
})

test("support can read catalog but not manage venues", () => {
  assert.equal(canPerformTenantAction("support", "catalog.read"), true)
  assert.equal(canPerformTenantAction("support", "catalog.manage"), false)
  assert.equal(canPerformTenantAction("support", "venue.manage"), false)
})

test("operator can manage catalog and venues", () => {
  assert.equal(canPerformTenantAction("operator", "catalog.manage"), true)
  assert.equal(canPerformTenantAction("operator", "venue.manage"), true)
  assert.equal(canPerformTenantAction("operator", "membership.manage"), false)
})

test("owner can manage memberships", () => {
  assert.equal(canPerformTenantAction("owner", "membership.manage"), true)
})
