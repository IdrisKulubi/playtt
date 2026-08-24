import { readFileSync } from "node:fs"
import { join } from "node:path"
import assert from "node:assert/strict"
import test from "node:test"

import { OPERATIONAL_ALERT_ACKNOWLEDGED_ACTION } from "./alert-actions-types.ts"

const operationsRoot = join(import.meta.dirname)
const repoRoot = join(import.meta.dirname, "..", "..", "..")

test("alert acknowledge service writes audited acknowledgement action", () => {
  const service = readFileSync(
    join(operationsRoot, "alert-actions-service.ts"),
    "utf8",
  )
  const route = readFileSync(
    join(repoRoot, "src", "app", "api", "admin", "alerts", "acknowledge", "route.ts"),
    "utf8",
  )

  assert.equal(OPERATIONAL_ALERT_ACKNOWLEDGED_ACTION, "operational_alert.acknowledged")
  assert.match(service, /writeAuditLog/)
  assert.match(route, /acknowledgeOperationalAlert/)
})

test("alert catalog includes access and network alerts", () => {
  const catalog = readFileSync(
    join(operationsRoot, "alert-catalog.ts"),
    "utf8",
  )

  assert.match(catalog, /access_credential_failed/)
  assert.match(catalog, /venue_network_offline/)
})
