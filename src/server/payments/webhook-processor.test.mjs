import assert from "node:assert/strict"
import { createHmac } from "node:crypto"
import test from "node:test"

import {
  processPaystackWebhook,
  verifyPaystackWebhookSignature,
} from "./webhook-processor.mjs"
import { hashWebhookPayload } from "./webhook-inbox-utils.mjs"

const secret = "test-paystack-secret"

function sign(rawBody) {
  return createHmac("sha512", secret).update(rawBody, "utf8").digest("hex")
}

function createInboxStore() {
  const store = new Map()
  let counter = 0

  return {
    store,
    async persistWebhook(input) {
      const payloadHash = hashWebhookPayload(input.rawBody)
      const existing = [...store.values()].find(
        (row) => row.payloadHash === payloadHash,
      )

      if (existing) {
        return existing
      }

      const id = `inbox-${++counter}`
      const row = {
        id,
        payloadHash,
        signature: input.signature,
        eventType: input.eventType,
        rawPayload: input.rawBody,
        status: "received",
        attempts: 0,
      }
      store.set(id, row)
      return row
    },
  }
}

test("valid signed event persists and returns OK without domain dispatch", async () => {
  const rawBody = JSON.stringify({ event: "charge.success", data: { id: 42 } })
  const inbox = createInboxStore()
  let dispatched = 0

  const result = await processPaystackWebhook({
    handleEvent: async () => {
      dispatched += 1
    },
    rawBody,
    secret,
    signature: sign(rawBody),
    persistWebhook: inbox.persistWebhook,
  })

  assert.deepEqual(result, { body: "OK", status: 200 })
  assert.equal(inbox.store.size, 1)
  assert.equal(dispatched, 0)
})

test("missing secret fails closed with retryable 500 and no persist", async () => {
  const rawBody = JSON.stringify({ event: "charge.success" })
  const inbox = createInboxStore()

  const result = await processPaystackWebhook({
    rawBody,
    secret: "  ",
    signature: sign(rawBody),
    persistWebhook: inbox.persistWebhook,
  })

  assert.equal(result.status, 500)
  assert.equal(result.body, "Webhook processing failed")
  assert.equal(result.failureKind, "configuration-error")
  assert.equal(inbox.store.size, 0)
})

for (const [label, signature] of [
  ["missing", null],
  ["non-hex", "z".repeat(128)],
  ["too short", "a".repeat(126)],
  ["too long", "a".repeat(130)],
]) {
  test(`${label} signature returns 401 without parsing or persisting`, async () => {
    const inbox = createInboxStore()
    const result = await processPaystackWebhook({
      rawBody: "not json",
      secret,
      signature,
      persistWebhook: inbox.persistWebhook,
    })

    assert.deepEqual(result, { body: "Invalid signature", status: 401 })
    assert.equal(inbox.store.size, 0)
  })
}

test("signature for an altered body is rejected", async () => {
  const signedBody = JSON.stringify({ amount: 1000 })
  const alteredBody = JSON.stringify({ amount: 1001 })
  const inbox = createInboxStore()

  const result = await processPaystackWebhook({
    rawBody: alteredBody,
    secret,
    signature: sign(signedBody),
    persistWebhook: inbox.persistWebhook,
  })

  assert.deepEqual(result, { body: "Invalid signature", status: 401 })
  assert.equal(inbox.store.size, 0)
})

test("valid signature with malformed JSON returns 400 without persisting", async () => {
  const rawBody = "{not-json"
  const inbox = createInboxStore()

  const result = await processPaystackWebhook({
    rawBody,
    secret,
    signature: sign(rawBody),
    persistWebhook: inbox.persistWebhook,
  })

  assert.deepEqual(result, { body: "Invalid payload", status: 400 })
  assert.equal(inbox.store.size, 0)
})

test("Unicode raw body verifies and persists without reserialization", async () => {
  const rawBody = JSON.stringify({ event: "charge.success", note: "M-Pesa ✓ 測試" })
  const inbox = createInboxStore()

  assert.equal(
    verifyPaystackWebhookSignature({ rawBody, secret, signature: sign(rawBody) }),
    true,
  )
  const result = await processPaystackWebhook({
    rawBody,
    secret,
    signature: sign(rawBody),
    persistWebhook: inbox.persistWebhook,
  })

  assert.equal(result.status, 200)
  assert.equal([...inbox.store.values()][0].rawPayload, rawBody)
})

test("duplicate signed delivery acknowledges one inbox identity", async () => {
  const rawBody = JSON.stringify({ event: "charge.success", data: { id: 99 } })
  const inbox = createInboxStore()

  const first = await processPaystackWebhook({
    rawBody,
    secret,
    signature: sign(rawBody),
    persistWebhook: inbox.persistWebhook,
  })
  const second = await processPaystackWebhook({
    rawBody,
    secret,
    signature: sign(rawBody),
    persistWebhook: inbox.persistWebhook,
  })

  assert.equal(first.status, 200)
  assert.equal(second.status, 200)
  assert.equal(inbox.store.size, 1)
})

test("inbox write failure returns retryable 500", async () => {
  const rawBody = JSON.stringify({ event: "charge.success" })

  const result = await processPaystackWebhook({
    rawBody,
    secret,
    signature: sign(rawBody),
    persistWebhook: async () => {
      throw new Error("database unavailable")
    },
  })

  assert.equal(result.status, 500)
  assert.equal(result.body, "Webhook processing failed")
  assert.equal(result.failureKind, "inbox-error")
})
