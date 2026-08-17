import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"

import { deliverThenMarkSent } from "./notification-delivery.mjs"

const repoRoot = join(import.meta.dirname, "..", "..", "..")
const paymentsRoot = import.meta.dirname
const workersRoot = join(repoRoot, "src", "server", "workers")
const bookingsRoot = join(repoRoot, "src", "server", "bookings")

test("confirmation email consumer marks sent only after idempotent provider delivery", () => {
  const source = readFileSync(
    join(paymentsRoot, "confirmation-email-consumer.ts"),
    "utf8",
  )

  assert.match(source, /eq\(notifications\.status, "pending"\)/)
  const sendIndex = source.indexOf("sendBookingConfirmationEmail")
  const sentIndex = source.indexOf('status: "sent"')

  assert.ok(sendIndex >= 0)
  assert.ok(sentIndex > sendIndex)
  assert.match(source, /idempotencyKey: `booking-confirmation\/\$\{pendingNotification\.id\}`/)
  assert.doesNotMatch(source.slice(0, sendIndex), /status: "sent"/)
})

test("confirmation email provider receives its deterministic idempotency key", () => {
  const source = readFileSync(join(paymentsRoot, "confirmation-email.ts"), "utf8")
  assert.match(source, /\{ idempotencyKey: input\.idempotencyKey \}/)
  assert.match(source, /if \(result\.error\)/)
  assert.match(source, /if \(!process\.env\.RESEND_API_KEY\?\.trim\(\)\) {\s*throw/s)
})

test("delivery failure remains recoverable and never marks the notification sent", async () => {
  let markedSent = false

  await assert.rejects(() =>
    deliverThenMarkSent({
      idempotencyKey: "booking-confirmation/notification-1",
      deliver: async () => {
        throw new Error("provider unavailable")
      },
      markSent: async () => {
        markedSent = true
      },
    }),
  )

  assert.equal(markedSent, false)
})

test("successful delivery uses the stable key before marking sent", async () => {
  const calls = []
  await deliverThenMarkSent({
    idempotencyKey: "booking-confirmation/notification-1",
    deliver: async (key) => calls.push(["deliver", key]),
    markSent: async () => calls.push(["mark-sent"]),
  })

  assert.deepEqual(calls, [
    ["deliver", "booking-confirmation/notification-1"],
    ["mark-sent"],
  ])
})

test("payment.confirmed.v1 consumer is registered in durable work cycle", () => {
  const source = readFileSync(join(workersRoot, "run-durable-work.ts"), "utf8")

  assert.match(source, /createPaymentConfirmedEmailConsumers/)
  assert.match(source, /createSessionLifecycleConsumers/)
})

test("backfill marks historical booking confirmation notifications as sent", () => {
  const source = readFileSync(
    join(repoRoot, "db", "backfill-confirmation-email-sent.sql"),
    "utf8",
  )

  assert.match(source, /template_key = 'booking_confirmed'/)
  assert.match(source, /status = 'sent'/)
})

test("booking list and detail expose optional playSession projection", () => {
  const typesSource = readFileSync(join(bookingsRoot, "types.ts"), "utf8")
  const repositorySource = readFileSync(join(bookingsRoot, "repository.ts"), "utf8")

  assert.match(typesSource, /playSession: PlaySessionProjection \| null/)
  assert.match(repositorySource, /playSessions/)
  assert.match(repositorySource, /playSession:/)
  assert.match(repositorySource, /scheduledStartAt/)
  assert.match(repositorySource, /scheduledEndAt/)
})

test("mobile booking contracts document playSession as additive", () => {
  const manifest = JSON.parse(
    readFileSync(
      join(repoRoot, "contracts", "mobile-api", "manifest.json"),
      "utf8",
    ),
  )

  const mine = manifest.endpoints.find((endpoint) => endpoint.id === "bookings.mine.get")
  const detail = manifest.endpoints.find(
    (endpoint) => endpoint.id === "bookings.detail.get",
  )

  assert.match(mine.notes.join(" "), /playSession is additive/)
  assert.match(detail.notes.join(" "), /playSession is additive/)
})
