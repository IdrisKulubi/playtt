import assert from "node:assert/strict"
import { createHmac } from "node:crypto"
import test from "node:test"

import {
  processPaystackWebhook,
  verifyPaystackWebhookSignature,
} from "./webhook-processor.ts"

const secret = "test-paystack-secret"

function sign(rawBody) {
  return createHmac("sha512", secret).update(rawBody, "utf8").digest("hex")
}

function createHandler() {
  const events = []
  return {
    events,
    handleEvent: async (event) => {
      events.push(event)
    },
  }
}

test("valid signed event dispatches exactly once and returns OK", async () => {
  const rawBody = JSON.stringify({ event: "charge.success", data: { id: 42 } })
  const handler = createHandler()

  const result = await processPaystackWebhook({
    handleEvent: handler.handleEvent,
    rawBody,
    secret,
    signature: sign(rawBody),
  })

  assert.deepEqual(result, { body: "OK", status: 200 })
  assert.deepEqual(handler.events, [
    { event: "charge.success", data: { id: 42 } },
  ])
})

test("missing secret fails closed with retryable 500 and no dispatch", async () => {
  const rawBody = JSON.stringify({ event: "charge.success" })
  const handler = createHandler()

  const result = await processPaystackWebhook({
    handleEvent: handler.handleEvent,
    rawBody,
    secret: "  ",
    signature: sign(rawBody),
  })

  assert.equal(result.status, 500)
  assert.equal(result.body, "Webhook processing failed")
  assert.equal(result.failureKind, "configuration-error")
  assert.deepEqual(handler.events, [])
})

for (const [label, signature] of [
  ["missing", null],
  ["non-hex", "z".repeat(128)],
  ["too short", "a".repeat(126)],
  ["too long", "a".repeat(130)],
]) {
  test(`${label} signature returns 401 without parsing or dispatching`, async () => {
    const handler = createHandler()
    const result = await processPaystackWebhook({
      handleEvent: handler.handleEvent,
      rawBody: "not json",
      secret,
      signature,
    })

    assert.deepEqual(result, { body: "Invalid signature", status: 401 })
    assert.deepEqual(handler.events, [])
  })
}

test("signature for an altered body is rejected", async () => {
  const signedBody = JSON.stringify({ amount: 1000 })
  const alteredBody = JSON.stringify({ amount: 1001 })
  const handler = createHandler()

  const result = await processPaystackWebhook({
    handleEvent: handler.handleEvent,
    rawBody: alteredBody,
    secret,
    signature: sign(signedBody),
  })

  assert.deepEqual(result, { body: "Invalid signature", status: 401 })
  assert.deepEqual(handler.events, [])
})

test("valid signature with malformed JSON returns 400 without dispatching", async () => {
  const rawBody = "{not-json"
  const handler = createHandler()

  const result = await processPaystackWebhook({
    handleEvent: handler.handleEvent,
    rawBody,
    secret,
    signature: sign(rawBody),
  })

  assert.deepEqual(result, { body: "Invalid payload", status: 400 })
  assert.deepEqual(handler.events, [])
})

test("Unicode raw body verifies and dispatches without reserialization", async () => {
  const rawBody = JSON.stringify({ event: "charge.success", note: "M-Pesa ✓ 測試" })
  const handler = createHandler()

  assert.equal(
    verifyPaystackWebhookSignature({ rawBody, secret, signature: sign(rawBody) }),
    true,
  )
  const result = await processPaystackWebhook({
    handleEvent: handler.handleEvent,
    rawBody,
    secret,
    signature: sign(rawBody),
  })

  assert.equal(result.status, 200)
  assert.equal(handler.events.length, 1)
  assert.equal(handler.events[0].note, "M-Pesa ✓ 測試")
})

test("handler rejection returns generic retryable 500 without leaking its message", async () => {
  const rawBody = JSON.stringify({ event: "charge.success" })
  const internalError = new Error("database password leaked")
  let calls = 0

  const result = await processPaystackWebhook({
    handleEvent: async () => {
      calls += 1
      throw internalError
    },
    rawBody,
    secret,
    signature: sign(rawBody),
  })

  assert.equal(calls, 1)
  assert.equal(result.status, 500)
  assert.equal(result.body, "Webhook processing failed")
  assert.equal(result.failureKind, "handler-error")
  assert.doesNotMatch(result.body, /database|password|leaked/i)
})
