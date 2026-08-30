import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"

import {
  buildSlackWebhookBody,
  buildWebhookBody,
} from "./alert-dispatch-channels.ts"
import {
  resolveAlertDispatchConfig,
  shouldDispatchAlert,
} from "./alert-dispatch-policy.ts"

const operationsRoot = join(import.meta.dirname)
const repoRoot = join(import.meta.dirname, "..", "..", "..")

const sampleAlert = {
  id: "worker_dead_letter:tenant",
  code: "worker_dead_letter",
  title: "Worker dead letter",
  severity: "critical",
  scope: "tenant",
  summary: "2 dead-letter jobs",
  venueId: null,
  venueName: null,
  installationId: null,
  recorderId: null,
  cameraSourceId: null,
  resourceId: null,
  owner: "platform-ops",
  escalation: "On-call operator",
  runbookPath: "docs/operations/runbooks/worker-dead-letter.md",
  href: "/admin/durable-work",
  firedAt: "2026-01-01T10:00:00.000Z",
}

test("resolveAlertDispatchConfig requires enabled flag and webhook url", () => {
  assert.equal(
    resolveAlertDispatchConfig({
      OPS_ALERT_DISPATCH_ENABLED: "true",
    }).enabled,
    false,
  )

  assert.equal(
    resolveAlertDispatchConfig({
      OPS_ALERT_DISPATCH_ENABLED: "true",
      OPS_ALERT_WEBHOOK_URL: "https://hooks.example.test/alert",
      OPS_ALERT_MIN_SEVERITY: "warning",
      OPS_ALERT_COOLDOWN_MINUTES: "15",
    }).enabled,
    true,
  )
})

test("shouldDispatchAlert respects configured minimum severity", () => {
  const config = resolveAlertDispatchConfig({
    OPS_ALERT_DISPATCH_ENABLED: "true",
    OPS_ALERT_WEBHOOK_URL: "https://hooks.example.test/alert",
    OPS_ALERT_MIN_SEVERITY: "critical",
  })

  assert.equal(shouldDispatchAlert("critical", config), true)
  assert.equal(shouldDispatchAlert("warning", config), false)
})

test("buildSlackWebhookBody includes alert summary and runbook path", () => {
  const body = buildSlackWebhookBody({
    source: "playtt",
    event: "operational_alert",
    severity: "critical",
    environment: "production",
    alert: sampleAlert,
    adminUrl: "https://playtt.test/admin/alerts",
  })

  assert.match(body.text, /Worker dead letter/)
  assert.match(body.blocks[0].text.text, /worker-dead-letter\.md/)
  assert.match(body.blocks[0].text.text, /https:\/\/playtt\.test\/admin\/alerts/)
})

test("buildWebhookBody returns generic payload for generic_webhook channel", () => {
  const payload = buildWebhookBody("generic_webhook", {
    source: "playtt",
    event: "operational_alert",
    severity: "critical",
    environment: "staging",
    alert: sampleAlert,
    adminUrl: null,
  })

  assert.equal(payload.event, "operational_alert")
  assert.equal(payload.alert.code, "worker_dead_letter")
})

test("alert dispatch service and cron route are wired for audited paging", () => {
  const service = readFileSync(
    join(operationsRoot, "alert-dispatch-service.ts"),
    "utf8",
  )
  const repository = readFileSync(
    join(operationsRoot, "alert-dispatch-repository.ts"),
    "utf8",
  )
  const cronRoute = readFileSync(
    join(repoRoot, "src", "app", "api", "cron", "operational-alerts", "route.ts"),
    "utf8",
  )
  const alertsPage = readFileSync(
    join(repoRoot, "src", "app", "admin", "alerts", "page.tsx"),
    "utf8",
  )

  assert.match(service, /OPERATIONAL_ALERT_DISPATCH_ACTION/)
  assert.match(service, /writeAuditLog/)
  assert.match(repository, /OPERATIONAL_ALERT_DISPATCH_ACTION/)
  assert.match(cronRoute, /dispatchOperationalAlerts/)
  assert.match(alertsPage, /getAlertDispatchStatus/)
})
