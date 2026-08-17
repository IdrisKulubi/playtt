import { readFileSync } from "node:fs"
import { join } from "node:path"
import assert from "node:assert/strict"
import test from "node:test"

const operatorRoot = join(import.meta.dirname)
const repoRoot = join(import.meta.dirname, "..", "..", "..")

test("operator durable work repository scopes dead-letter queries by tenant", () => {
  const source = readFileSync(
    join(operatorRoot, "durable-work-repository.ts"),
    "utf8",
  )

  assert.match(source, /eq\(paymentWebhookInbox\.tenantId, context\.tenantId\)/)
  assert.match(source, /eq\(outboxEvents\.tenantId, context\.tenantId\)/)
  assert.match(source, /countWebhookInboxByStatus\(context\.tenantId\)/)
  assert.match(source, /countOutboxEventsByStatus\(context\.tenantId\)/)
  assert.match(source, /eq\(paymentWebhookInbox\.status, "dead_letter"\)/)
  assert.match(source, /eq\(outboxEvents\.status, "dead_letter"\)/)
})

test("operator durable work routes use session auth and replay audit writes", () => {
  const getRoute = readFileSync(
    join(repoRoot, "src", "app", "api", "operator", "durable-work", "route.ts"),
    "utf8",
  )
  const replayRoute = readFileSync(
    join(
      repoRoot,
      "src",
      "app",
      "api",
      "operator",
      "durable-work",
      "replay",
      "route.ts",
    ),
    "utf8",
  )
  const service = readFileSync(
    join(operatorRoot, "durable-work-service.ts"),
    "utf8",
  )

  assert.match(getRoute, /getDurableWorkOverview/)
  assert.match(getRoute, /canAccessOperatorShell/)
  assert.match(replayRoute, /replayDurableWork/)
  assert.match(service, /writeAuditLog/)
  assert.match(service, /replayWebhookInbox/)
  assert.match(service, /replayOutboxEvent/)
  assert.match(service, /authorize\(context, "catalog\.manage"\)/)
})

test("operator shell links to durable work page", () => {
  const source = readFileSync(
    join(repoRoot, "src", "components", "operator", "operator-shell.tsx"),
    "utf8",
  )

  assert.match(source, /\/operator\/durable-work/)
  assert.match(source, /Durable work/)
})
