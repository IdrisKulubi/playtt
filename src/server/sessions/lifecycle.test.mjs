import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"

import {
  isPlaySessionAtOrPastStatus,
  isTerminalPlaySessionStatus,
  nextLifecycleIntent,
  sessionLifecycleIdempotencyKey,
} from "./lifecycle-schedule.mjs"

const repoRoot = join(import.meta.dirname, "..", "..", "..")

test("confirmed sessions schedule prepare two minutes before start", () => {
  const now = new Date("2026-08-17T10:00:00.000Z")
  const intent = nextLifecycleIntent(
    {
      status: "confirmed",
      scheduledStartAt: "2026-08-17T11:00:00.000Z",
      scheduledEndAt: "2026-08-17T12:00:00.000Z",
    },
    now,
  )

  assert.equal(intent?.eventType, "session.preparing.v1")
  assert.equal(intent?.toStatus, "preparing")
  assert.equal(intent?.availableAt.toISOString(), "2026-08-17T10:58:00.000Z")
})

test("overdue confirmed sessions become available immediately", () => {
  const now = new Date("2026-08-17T12:00:00.000Z")
  const intent = nextLifecycleIntent(
    {
      status: "confirmed",
      scheduledStartAt: "2026-08-17T11:00:00.000Z",
      scheduledEndAt: "2026-08-17T11:30:00.000Z",
    },
    now,
  )

  assert.equal(intent?.toStatus, "preparing")
  assert.equal(intent?.availableAt.toISOString(), now.toISOString())
})

test("lifecycle advances preparing to start, active to ending, then complete and reset", () => {
  const now = new Date("2026-08-17T10:00:00.000Z")
  const start = "2026-08-17T11:00:00.000Z"
  const end = "2026-08-17T12:00:00.000Z"

  assert.deepEqual(
    {
      eventType: nextLifecycleIntent(
        { status: "preparing", scheduledStartAt: start, scheduledEndAt: end },
        now,
      )?.eventType,
      toStatus: nextLifecycleIntent(
        { status: "preparing", scheduledStartAt: start, scheduledEndAt: end },
        now,
      )?.toStatus,
    },
    { eventType: "session.started.v1", toStatus: "active" },
  )

  assert.equal(
    nextLifecycleIntent(
      { status: "active", scheduledStartAt: start, scheduledEndAt: end },
      now,
    )?.eventType,
    "session.ending.v1",
  )
  assert.equal(
    nextLifecycleIntent(
      { status: "ending", scheduledStartAt: start, scheduledEndAt: end },
      now,
    )?.eventType,
    "session.completed.v1",
  )
  assert.equal(
    nextLifecycleIntent(
      { status: "completed", scheduledStartAt: start, scheduledEndAt: end },
      now,
    )?.eventType,
    "session.resetting.v1",
  )
  assert.equal(
    nextLifecycleIntent(
      { status: "resetting", scheduledStartAt: start, scheduledEndAt: end },
      now,
    )?.toStatus,
    "available",
  )
})

test("available and held sessions are terminal for the scheduler", () => {
  assert.equal(isTerminalPlaySessionStatus("available"), true)
  assert.equal(isTerminalPlaySessionStatus("held"), true)
  assert.equal(
    nextLifecycleIntent({
      status: "available",
      scheduledStartAt: "2026-08-17T11:00:00.000Z",
      scheduledEndAt: "2026-08-17T12:00:00.000Z",
    }),
    null,
  )
})

test("catch-up treats later happy-path statuses as already applied", () => {
  assert.equal(isPlaySessionAtOrPastStatus("active", "preparing"), true)
  assert.equal(isPlaySessionAtOrPastStatus("confirmed", "preparing"), false)
  assert.equal(isPlaySessionAtOrPastStatus("available", "completed"), true)
})

test("lifecycle idempotency keys include event, session, and target status", () => {
  assert.equal(
    sessionLifecycleIdempotencyKey(
      "session.preparing.v1",
      "session-1",
      "preparing",
    ),
    "session.preparing.v1:session-1:preparing",
  )
})

test("confirmation schedules the next lifecycle intent inside the transaction", () => {
  const source = readFileSync(
    join(repoRoot, "src", "server", "payments", "confirmation-side-effects.ts"),
    "utf8",
  )
  assert.match(source, /scheduleNextLifecycleIntent/)
})

test("durable work reconciles sessions then claims registered lifecycle consumers", () => {
  const source = readFileSync(
    join(repoRoot, "src", "server", "workers", "run-durable-work.ts"),
    "utf8",
  )
  assert.match(source, /reconcilePlaySessionLifecycle/)
  assert.match(source, /createSessionLifecycleConsumers/)
  assert.match(source, /outboxRounds: 6/)
})

test("enqueueOutboxEvent persists availableAt for delayed lifecycle work", () => {
  const source = readFileSync(
    join(repoRoot, "src", "server", "workers", "outbox-repository.ts"),
    "utf8",
  )
  assert.match(source, /availableAt\?: Date \| string \| null/)
  assert.match(source, /availableAt: new Date\(input\.availableAt\)/)
})
