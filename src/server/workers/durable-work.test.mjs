import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

import {
  nextBackoffMs,
  nextFailureState,
  resolveOutboxConsumer,
  shouldDeadLetter,
  WORKER_MAX_ATTEMPTS,
} from "./backoff.mjs"
import { buildClaimOutboxSql, CLAIM_INBOX_SQL } from "./claim-sql.mjs"
import {
  processClaimedInboxRow,
  processClaimedOutboxRow,
  runDurableWork,
} from "./run-durable-work.mjs"

const repoRoot = join(import.meta.dirname, "..", "..", "..")

test("Vercel deployment schedules durable work and booking expiry", () => {
  const deployment = JSON.parse(readFileSync(join(repoRoot, "vercel.json"), "utf8"))
  assert.deepEqual(deployment.crons, [
    { path: "/api/cron/durable-work", schedule: "* * * * *" },
    { path: "/api/cron/expire-bookings", schedule: "*/5 * * * *" },
  ])
})

test("schema and migration define outbox events with lease and idempotency identity", () => {
  const schemaSource = readFileSync(join(repoRoot, "db", "schema.ts"), "utf8")
  const migrationSource = readFileSync(
    join(repoRoot, "drizzle", "0013_outbox_events.sql"),
    "utf8",
  )

  assert.match(schemaSource, /outbox_events/)
  assert.match(schemaSource, /idempotency_key/)
  assert.match(schemaSource, /lease_expires_at/)
  assert.match(migrationSource, /FOR UPDATE SKIP LOCKED|outbox_events_claim_idx/)
  assert.match(migrationSource, /outbox_events_idempotency_unique/)
  assert.match(CLAIM_INBOX_SQL, /FOR UPDATE SKIP LOCKED/)
  assert.match(buildClaimOutboxSql(true), /FOR UPDATE SKIP LOCKED/)
  assert.equal(buildClaimOutboxSql(false), null)
})

test("backoff doubles until the cap and dead-letters after max attempts", () => {
  assert.equal(nextBackoffMs(1), 1000)
  assert.equal(nextBackoffMs(2), 2000)
  assert.equal(nextBackoffMs(3), 4000)
  assert.equal(shouldDeadLetter(WORKER_MAX_ATTEMPTS - 1), false)
  assert.equal(shouldDeadLetter(WORKER_MAX_ATTEMPTS), true)

  const retry = nextFailureState(1, "boom", new Date("2026-08-17T12:00:00.000Z"))
  assert.equal(retry.status, "failed")
  assert.equal(retry.availableAt, "2026-08-17T12:00:01.000Z")

  const dead = nextFailureState(
    WORKER_MAX_ATTEMPTS,
    "boom",
    new Date("2026-08-17T12:00:00.000Z"),
  )
  assert.equal(dead.status, "dead_letter")
})

test("unsupported outbox versions are ignored without crashing", () => {
  const registry = {
    "payment.confirmed.v1": { eventVersion: 1, consume: async () => {} },
  }

  assert.equal(
    resolveOutboxConsumer("payment.confirmed.v1", 2, registry).kind,
    "unsupported-version",
  )
  assert.equal(
    resolveOutboxConsumer("session.started.v1", 1, registry).kind,
    "unregistered",
  )
  assert.equal(
    resolveOutboxConsumer("payment.confirmed.v1", 1, registry).kind,
    "ok",
  )
})

test("inbox worker dispatches once and recovers after a handler crash", async () => {
  const processed = []
  const retries = []
  let calls = 0

  const first = await processClaimedInboxRow({
    row: {
      id: "inbox-1",
      attempts: 1,
      rawPayload: JSON.stringify({ event: "charge.success" }),
    },
    handleEvent: async () => {
      calls += 1
      throw new Error("database password leaked")
    },
    markProcessed: async (id) => processed.push(id),
    markRetryOrDeadLetter: async (id, next) => retries.push({ id, ...next }),
  })

  assert.equal(first.outcome, "failed")
  assert.equal(calls, 1)
  assert.equal(processed.length, 0)
  assert.equal(retries[0].status, "failed")
  assert.doesNotMatch(retries[0].lastError, /password/i)

  const second = await processClaimedInboxRow({
    row: {
      id: "inbox-1",
      attempts: 2,
      rawPayload: JSON.stringify({ event: "charge.success" }),
    },
    handleEvent: async (event) => {
      calls += 1
      processed.push(event.event)
    },
    markProcessed: async (id) => processed.push(id),
    markRetryOrDeadLetter: async (id, next) => retries.push({ id, ...next }),
  })

  assert.equal(second.outcome, "processed")
  assert.equal(calls, 2)
  assert.deepEqual(processed, ["charge.success", "inbox-1"])
})

test("expired lease rows can be claimed again without duplicating success", async () => {
  const claimed = []
  const store = [
    {
      id: "outbox-1",
      eventType: "payment.confirmed.v1",
      eventVersion: 1,
      attempts: 1,
      status: "processing",
    },
  ]

  const report = await runDurableWork({
    owner: "worker-test",
    registry: {
      "payment.confirmed.v1": {
        eventVersion: 1,
        consume: async (row) => {
          claimed.push(row.id)
        },
      },
    },
    outboxRepository: {
      async claimOutboxWork() {
        return store
      },
      async markOutboxProcessed(id) {
        store[0].status = "processed"
        store[0].id = id
      },
      async markOutboxRetryOrDeadLetter() {},
      async countOutboxEventsByStatus() {
        return { processed: 1 }
      },
    },
  })

  const second = await runDurableWork({
    owner: "worker-test-2",
    registry: {
      "payment.confirmed.v1": {
        eventVersion: 1,
        consume: async (row) => {
          claimed.push(row.id)
        },
      },
    },
    outboxRepository: {
      async claimOutboxWork() {
        return store[0].status === "processed" ? [] : store
      },
      async markOutboxProcessed() {},
      async markOutboxRetryOrDeadLetter() {},
    },
  })

  assert.equal(report.outbox.processed, 1)
  assert.equal(second.outbox.claimed, 0)
  assert.deepEqual(claimed, ["outbox-1"])
})

test("unregistered outbox types are not claimed", async () => {
  const report = await runDurableWork({
    registry: {},
    outboxRepository: {
      async claimOutboxWork() {
        throw new Error("should not claim without consumers")
      },
      async markOutboxProcessed() {},
      async markOutboxRetryOrDeadLetter() {},
    },
  })

  assert.equal(report.outbox.claimed, 0)
})

test("unsupported registered versions are dead-lettered without dispatch", async () => {
  const failures = []
  const result = await processClaimedOutboxRow({
    row: {
      id: "outbox-2",
      eventType: "payment.confirmed.v1",
      eventVersion: 2,
      attempts: 1,
    },
    registry: {
      "payment.confirmed.v1": { eventVersion: 1, consume: async () => {} },
    },
    markProcessed: async () => {
      throw new Error("unsupported versions must not be processed")
    },
    markRetryOrDeadLetter: async (id, next) => failures.push({ id, ...next }),
  })

  assert.equal(result.outcome, "dead_letter")
  assert.equal(failures.length, 1)
  assert.equal(failures[0].id, "outbox-2")
  assert.equal(failures[0].status, "dead_letter")
})

test("reconcile hook runs before claiming and extra outbox rounds drain follow-up work", async () => {
  const calls = []
  let remaining = [
    { id: "session-1", eventType: "session.preparing.v1", eventVersion: 1 },
    { id: "session-2", eventType: "session.started.v1", eventVersion: 1 },
  ]

  const report = await runDurableWork({
    reconcile: async () => {
      calls.push("reconcile")
      return { scanned: 2, scheduled: 2 }
    },
    outboxRounds: 3,
    registry: {
      "session.preparing.v1": {
        eventVersion: 1,
        consume: async (row) => calls.push(row.id),
      },
      "session.started.v1": {
        eventVersion: 1,
        consume: async (row) => calls.push(row.id),
      },
    },
    outboxRepository: {
      async claimOutboxWork() {
        const next = remaining.shift()
        return next ? [next] : []
      },
      async markOutboxProcessed() {},
      async markOutboxRetryOrDeadLetter() {},
    },
  })

  assert.deepEqual(report.reconcile, { scanned: 2, scheduled: 2 })
  assert.equal(report.outbox.processed, 2)
  assert.deepEqual(calls, ["reconcile", "session-1", "session-2"])
})
