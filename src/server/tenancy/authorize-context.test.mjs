import assert from "node:assert/strict"
import test from "node:test"

import { authorize } from "./authorize-context.mjs"
import {
  createServiceTenantContext,
  resolvePlayTtPublicContext,
  resolveTenantContextForDevice,
} from "./context-factory.mjs"
import { requireTenantContext } from "./require-context.mjs"
import { TenancyError } from "./errors.ts"
import { PLAYTT_TENANT_ID } from "./constants.ts"

const customerContext = {
  tenantId: PLAYTT_TENANT_ID,
  actor: { type: "user", id: "user-1" },
  role: "customer",
  correlationId: "corr-1",
}

test("authorize allows customer booking reads and blocks catalog management", () => {
  assert.doesNotThrow(() => authorize(customerContext, "booking.read"))
  assert.throws(
    () => authorize(customerContext, "catalog.manage"),
    TenancyError,
  )
})

test("public catalog context allows venue reads only", () => {
  const context = resolvePlayTtPublicContext({ correlationId: "corr-public" })
  assert.doesNotThrow(() => authorize(context, "venue.read"))
  assert.throws(() => authorize(context, "booking.create"), TenancyError)
})

test("service context can perform tenant-scoped writes", () => {
  const context = createServiceTenantContext({
    tenantId: PLAYTT_TENANT_ID,
    actorId: "paystack-webhook",
    correlationId: "corr-service",
  })
  assert.doesNotThrow(() => authorize(context, "catalog.manage"))
})

test("device context entry point is reserved for Phase 5", () => {
  assert.throws(() => resolveTenantContextForDevice(), TenancyError)
})

test("requireTenantContext rejects incomplete context", () => {
  assert.throws(
    () => requireTenantContext({ tenantId: PLAYTT_TENANT_ID }),
    TenancyError,
  )
})
