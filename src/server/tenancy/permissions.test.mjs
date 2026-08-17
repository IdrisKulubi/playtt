import assert from "node:assert/strict"
import test from "node:test"

import {
  canPerformTenantAction,
  isTenantAction,
} from "./permissions-core.mjs"
import { authorizeTenantAction } from "./authorize.mjs"
import { TenancyError } from "./errors.ts"
import {
  mapMembershipToTenantContext,
  rejectClientTenantId,
} from "./membership-context.mjs"
import { PLAYTT_TENANT_ID } from "./constants.ts"

test("customer cannot manage venues but operator can", () => {
  assert.equal(canPerformTenantAction("customer", "venue.manage"), false)
  assert.equal(canPerformTenantAction("operator", "venue.manage"), true)
})

test("support is read-only for catalog and membership", () => {
  assert.equal(canPerformTenantAction("support", "catalog.read"), true)
  assert.equal(canPerformTenantAction("support", "catalog.manage"), false)
  assert.equal(canPerformTenantAction("support", "membership.manage"), false)
})

test("owner can manage memberships", () => {
  assert.equal(canPerformTenantAction("owner", "membership.manage"), true)
})

test("unknown tenant action strings are rejected", () => {
  assert.equal(isTenantAction("venue.delete"), false)
})

test("authorizeTenantAction throws TenancyError for forbidden actions", () => {
  assert.throws(() => authorizeTenantAction("customer", "venue.manage"), TenancyError)
})

test("rejectClientTenantId rejects forged tenant identifiers", () => {
  assert.throws(() => rejectClientTenantId(PLAYTT_TENANT_ID), TenancyError)
})

test("mapMembershipToTenantContext builds trusted PlayTT context", () => {
  const context = mapMembershipToTenantContext({
    userId: "user-1",
    membershipId: "membership-1",
    tenantId: PLAYTT_TENANT_ID,
    role: "customer",
    status: "active",
    correlationId: "corr-1",
  })

  assert.equal(context.tenantId, PLAYTT_TENANT_ID)
  assert.equal(context.actor.id, "user-1")
  assert.equal(context.role, "customer")
  assert.equal(context.membershipId, "membership-1")
})

test("disabled memberships cannot produce tenant context", () => {
  assert.throws(
    () =>
      mapMembershipToTenantContext({
        userId: "user-1",
        membershipId: "membership-1",
        tenantId: PLAYTT_TENANT_ID,
        role: "customer",
        status: "disabled",
        correlationId: "corr-1",
      }),
    TenancyError,
  )
})
