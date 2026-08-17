import { readFileSync } from "node:fs"
import { join } from "node:path"
import assert from "node:assert/strict"
import test from "node:test"

import {
  extractPaystackProviderEventId,
  hashWebhookPayload,
} from "./webhook-inbox-utils.mjs"

const repoRoot = join(import.meta.dirname, "..", "..", "..")
const schemaSource = readFileSync(join(repoRoot, "db", "schema.ts"), "utf8")
const migrationSource = readFileSync(
  join(repoRoot, "drizzle", "0012_payment_webhook_inbox.sql"),
  "utf8",
)

test("schema defines payment webhook inbox without inline domain processing", () => {
  assert.match(schemaSource, /payment_webhook_inbox/)
  assert.match(schemaSource, /payment_webhook_inbox_status/)
  assert.match(schemaSource, /payload_hash/)
  assert.match(schemaSource, /payment_webhook_inbox_provider_payload_hash_unique/)
})

test("migration adds provider identity and payload hash uniqueness", () => {
  assert.match(migrationSource, /payment_webhook_inbox_provider_payload_hash_unique/)
  assert.match(migrationSource, /payment_webhook_inbox_provider_event_unique/)
})

test("hashWebhookPayload is stable for identical raw bodies", () => {
  const rawBody = JSON.stringify({ event: "charge.success", data: { id: 1 } })
  assert.equal(hashWebhookPayload(rawBody), hashWebhookPayload(rawBody))
})

test("extractPaystackProviderEventId scopes provider identity by event type", () => {
  assert.equal(
    extractPaystackProviderEventId({
      event: "charge.success",
      data: { id: 42 },
    }),
    "charge.success:42",
  )
})

test("webhook processor persists before acknowledgement and does not dispatch inline", () => {
  const source = readFileSync(
    join(import.meta.dirname, "webhook-processor.mjs"),
    "utf8",
  )
  assert.match(source, /persistWebhook/)
  assert.doesNotMatch(source, /handleEvent\(/)
})
