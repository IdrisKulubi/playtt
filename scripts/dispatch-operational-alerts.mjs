import process from "node:process"

import { dispatchOperationalAlerts } from "../src/server/operations/alert-dispatch-service.ts"
import { PLAYTT_TENANT_ID } from "../src/server/tenancy/constants.ts"
import { createServiceTenantContext } from "../src/server/tenancy/context-factory.mjs"

const context = createServiceTenantContext({
  tenantId: PLAYTT_TENANT_ID,
  actorId: "operational-alerts-cli",
  correlationId: `operational-alerts:${Date.now()}`,
})

const report = await dispatchOperationalAlerts(context)

console.log(`Dispatch enabled: ${report.config.enabled}`)
console.log(
  `Sent: ${report.sentCount} · Skipped: ${report.skippedCount} · Failed: ${report.failedCount}`,
)

for (const attempt of report.attempts) {
  console.log(
    `[${attempt.status.toUpperCase()}] ${attempt.alertCode} (${attempt.alertId})${
      attempt.reason ? `: ${attempt.reason}` : ""
    }`,
  )
}

if (report.failedCount > 0) {
  process.exitCode = 1
}
