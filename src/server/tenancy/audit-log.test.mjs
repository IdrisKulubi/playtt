import assert from "node:assert/strict"
import test from "node:test"

import { PLAYTT_TENANT_ID } from "./constants.ts"

const customerContext = {
  tenantId: PLAYTT_TENANT_ID,
  actor: { type: "user", id: "user-1" },
  role: "customer",
  membershipId: "membership-1",
  correlationId: "corr-audit",
}

test("writeAuditLog inserts tenant-scoped audit rows when database is available", async (t) => {
  if (!process.env.POSTGRES_URL) {
    t.skip("POSTGRES_URL is not configured")
    return
  }

  const { writeAuditLog } = await import("./audit-log.mjs")
  const row = await writeAuditLog(customerContext, {
    action: "membership.read",
    targetType: "tenant_membership",
    targetId: "membership-1",
    metadata: { source: "test" },
  })

  assert.equal(row.tenantId, PLAYTT_TENANT_ID)
  assert.equal(row.action, "membership.read")
})
