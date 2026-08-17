import { readFileSync } from "node:fs"
import { join } from "node:path"
import assert from "node:assert/strict"
import test from "node:test"

import {
  bookingConfirmedIdempotencyKey,
  buildBookingConfirmedOutboxEvent,
  buildPaymentConfirmedOutboxEvent,
  EVENT_TYPES,
  paymentConfirmedIdempotencyKey,
} from "../workers/events.mjs"

const repoRoot = join(import.meta.dirname, "..", "..", "..")
const paymentsRoot = import.meta.dirname

test("confirmation events use versioned names and stable idempotency keys", () => {
  assert.equal(EVENT_TYPES.PAYMENT_CONFIRMED_V1, "payment.confirmed.v1")
  assert.equal(EVENT_TYPES.BOOKING_CONFIRMED_V1, "booking.confirmed.v1")
  assert.equal(
    paymentConfirmedIdempotencyKey("pay-1"),
    "payment.confirmed.v1:pay-1",
  )
  assert.equal(
    bookingConfirmedIdempotencyKey("book-1"),
    "booking.confirmed.v1:book-1",
  )
})

test("confirmation outbox builders include scoped envelope fields", () => {
  const paymentEvent = buildPaymentConfirmedOutboxEvent({
    tenantId: "tenant-1",
    locationId: "venue-1",
    resourceId: "resource-1",
    playSessionId: "session-1",
    correlationId: "corr-1",
    bookingId: "book-1",
    paymentId: "pay-1",
    reference: "ref-1",
    amount: "1000.00",
    currency: "KES",
    source: "webhook",
  })

  assert.equal(paymentEvent.aggregateType, "payment")
  assert.equal(paymentEvent.eventType, "payment.confirmed.v1")
  assert.equal(paymentEvent.sessionId, "session-1")
  assert.equal(paymentEvent.payload.bookingId, "book-1")

  const bookingEvent = buildBookingConfirmedOutboxEvent({
    tenantId: "tenant-1",
    locationId: "venue-1",
    resourceId: "resource-1",
    playSessionId: "session-1",
    correlationId: "corr-1",
    bookingId: "book-1",
    userId: "user-1",
    startTime: "2026-08-17T10:00:00.000Z",
    endTime: "2026-08-17T11:00:00.000Z",
  })

  assert.equal(bookingEvent.aggregateType, "booking")
  assert.equal(bookingEvent.eventType, "booking.confirmed.v1")
  assert.equal(bookingEvent.payload.playSessionId, "session-1")
})

test("confirm booking writes session and outbox events inside the transaction", () => {
  const source = readFileSync(join(paymentsRoot, "confirm-booking.ts"), "utf8")

  assert.match(source, /writeConfirmationDurableSideEffects/)
  assert.match(source, /repairConfirmationDurableSideEffects/)
  assert.doesNotMatch(source, /schedulePlaySessionEnsure/)

  const transactionBody = source.match(
    /db\.transaction\(async \(tx\) => \{([\s\S]*?)\n  \}\)/,
  )?.[1]

  assert.ok(transactionBody)
  assert.match(transactionBody, /writeConfirmationDurableSideEffects\(tx/)
  assert.doesNotMatch(transactionBody, /sendBookingConfirmationEmail/)
})

test("confirmation side effects ensure session and enqueue both outbox events", () => {
  const source = readFileSync(
    join(paymentsRoot, "confirmation-side-effects.ts"),
    "utf8",
  )

  assert.match(source, /ensurePlaySessionForBooking/)
  assert.match(source, /buildPaymentConfirmedOutboxEvent/)
  assert.match(source, /buildBookingConfirmedOutboxEvent/)
  assert.match(source, /enqueueOutboxEvent\([\s\S]*\btx\b/)
})

test("confirmation email still sends after commit, not inside transaction", () => {
  const source = readFileSync(join(paymentsRoot, "confirm-booking.ts"), "utf8")
  const transactionBody = source.match(
    /db\.transaction\(async \(tx\) => \{([\s\S]*?)\n  \}\)/,
  )?.[1]

  assert.ok(transactionBody)
  assert.doesNotMatch(transactionBody, /sendBookingConfirmationEmail/)
  assert.match(source, /sendBookingConfirmationEmail/)
})

test("already confirmed repair path does not mutate payment or booking again", () => {
  const source = readFileSync(join(paymentsRoot, "confirm-booking.ts"), "utf8")

  assert.match(source, /repairConfirmationDurableSideEffects/)
  assert.match(
    readFileSync(join(paymentsRoot, "confirmation-side-effects.ts"), "utf8"),
    /repairConfirmationDurableSideEffects[\s\S]*db\.transaction/,
  )
  assert.doesNotMatch(
    source.match(
      /if \(existingPayment\.status === "paid"\) \{([\s\S]*?)\n  \}/,
    )?.[1] ?? "",
    /\.update\(payments\)/,
  )
})

test("outbox repository accepts optional transaction executor", () => {
  const source = readFileSync(
    join(repoRoot, "src", "server", "workers", "outbox-repository.ts"),
    "utf8",
  )

  assert.match(source, /enqueueOutboxEvent\([\s\S]*tx\?: DbExecutor/)
  assert.match(source, /const executor = tx \?\? db/)
})

test("play session ensure accepts optional transaction executor", () => {
  const source = readFileSync(
    join(repoRoot, "src", "server", "sessions", "play-sessions.ts"),
    "utf8",
  )

  assert.match(source, /ensurePlaySessionForBooking\([\s\S]*tx\?: DbExecutor/)
  assert.match(source, /const executor = tx \?\? db/)
})
