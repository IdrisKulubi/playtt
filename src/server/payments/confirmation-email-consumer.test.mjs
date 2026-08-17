import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"

const repoRoot = join(import.meta.dirname, "..", "..", "..")
const paymentsRoot = import.meta.dirname
const workersRoot = join(repoRoot, "src", "server", "workers")
const bookingsRoot = join(repoRoot, "src", "server", "bookings")

test("confirmation email consumer claims pending notifications before sending", () => {
  const source = readFileSync(
    join(paymentsRoot, "confirmation-email-consumer.ts"),
    "utf8",
  )

  assert.match(source, /eq\(notifications\.status, "pending"\)/)
  assert.match(source, /status: "sent"/)
  assert.match(source, /sendBookingConfirmationEmail/)
  assert.match(source, /status: "pending"/)
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
