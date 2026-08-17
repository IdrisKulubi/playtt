import { randomUUID } from "node:crypto"

import {
  nextFailureState,
  resolveOutboxConsumer,
  WORKER_CLAIM_LIMIT,
  WORKER_LEASE_MS,
  claimableOutboxEventTypes,
} from "./backoff.mjs"
import { CLAIM_INBOX_SQL, buildClaimOutboxSql } from "./claim-sql.mjs"
import { getRegisteredOutboxConsumers } from "./consumers.mjs"

export function createEmptyDurableWorkReport() {
  return {
    inbox: {
      claimed: 0,
      processed: 0,
      failed: 0,
      deadLettered: 0,
    },
    outbox: {
      claimed: 0,
      processed: 0,
      failed: 0,
      deadLettered: 0,
      skippedUnsupported: 0,
    },
  }
}

export async function processClaimedInboxRow(input) {
  const { row, handleEvent, markProcessed, markRetryOrDeadLetter } = input

  let event
  try {
    event = JSON.parse(row.rawPayload)
  } catch {
    await markRetryOrDeadLetter(
      row.id,
      nextFailureState(row.attempts, "Stored webhook payload is invalid JSON."),
    )
    return { outcome: "failed" }
  }

  try {
    await handleEvent(event)
    await markProcessed(row.id)
    return { outcome: "processed" }
  } catch {
    const next = nextFailureState(row.attempts, "Webhook handler failed.")
    await markRetryOrDeadLetter(row.id, next)
    return { outcome: next.status === "dead_letter" ? "dead_letter" : "failed" }
  }
}

export async function processClaimedOutboxRow(input) {
  const { row, registry, markProcessed, markRetryOrDeadLetter } = input
  const resolved = resolveOutboxConsumer(
    row.eventType,
    row.eventVersion,
    registry,
  )

  if (resolved.kind === "unsupported-version") {
    await markRetryOrDeadLetter(row.id, {
      status: "dead_letter",
      availableAt: new Date().toISOString(),
      lastError: "Outbox event version is unsupported.",
    })
    return { outcome: "dead_letter" }
  }

  if (resolved.kind !== "ok") {
    const next = nextFailureState(row.attempts, "Outbox consumer was not found.")
    await markRetryOrDeadLetter(row.id, {
      ...next,
      status: next.status === "dead_letter" ? "dead_letter" : "pending",
    })
    return { outcome: next.status === "dead_letter" ? "dead_letter" : "failed" }
  }

  try {
    await resolved.consume(row)
    await markProcessed(row.id)
    return { outcome: "processed" }
  } catch {
    const next = nextFailureState(row.attempts, "Outbox consumer failed.")
    await markRetryOrDeadLetter(row.id, {
      ...next,
      status: next.status === "dead_letter" ? "dead_letter" : "pending",
    })
    return { outcome: next.status === "dead_letter" ? "dead_letter" : "failed" }
  }
}

export async function runDurableWork(input = {}) {
  const report = createEmptyDurableWorkReport()
  const owner = input.owner ?? `worker:${randomUUID()}`
  const limit = input.limit ?? WORKER_CLAIM_LIMIT
  const leaseMs = input.leaseMs ?? WORKER_LEASE_MS
  const registry = input.registry ?? getRegisteredOutboxConsumers()
  const outboxRounds = input.outboxRounds ?? 1

  if (typeof input.reconcile === "function") {
    report.reconcile = await input.reconcile()
  }

  const inboxRepo = input.inboxRepository
  const outboxRepo = input.outboxRepository
  const handleEvent = input.handleEvent

  if (inboxRepo && handleEvent) {
    const claimed = await inboxRepo.claimWebhookInboxWork({
      limit,
      leaseMs,
      owner,
      claimSql: CLAIM_INBOX_SQL,
    })
    report.inbox.claimed = claimed.length

    for (const row of claimed) {
      const result = await processClaimedInboxRow({
        row,
        handleEvent,
        markProcessed: inboxRepo.markWebhookInboxProcessed,
        markRetryOrDeadLetter: async (id, next) =>
          inboxRepo.markWebhookInboxRetryOrDeadLetter(id, {
            status: next.status,
            availableAt: new Date(next.availableAt),
            lastError: next.lastError,
          }),
      })

      if (result.outcome === "processed") report.inbox.processed += 1
      if (result.outcome === "failed") report.inbox.failed += 1
      if (result.outcome === "dead_letter") report.inbox.deadLettered += 1
    }
  }

  const eventTypes = claimableOutboxEventTypes(registry)
  const claimSql = buildClaimOutboxSql(eventTypes.length > 0)

  if (outboxRepo && claimSql) {
    for (let round = 0; round < outboxRounds; round += 1) {
      const claimed = await outboxRepo.claimOutboxWork({
        limit,
        leaseMs,
        owner,
        eventTypes,
        claimSql,
      })
      report.outbox.claimed += claimed.length

      if (claimed.length === 0) {
        break
      }

      for (const row of claimed) {
        const result = await processClaimedOutboxRow({
          row,
          registry,
          markProcessed: outboxRepo.markOutboxProcessed,
          markRetryOrDeadLetter: async (id, next) =>
            outboxRepo.markOutboxRetryOrDeadLetter(id, {
              status: next.status,
              availableAt: new Date(next.availableAt),
              lastError: next.lastError,
            }),
        })

        if (result.outcome === "processed") report.outbox.processed += 1
        if (result.outcome === "failed") report.outbox.failed += 1
        if (result.outcome === "dead_letter") report.outbox.deadLettered += 1
        if (result.outcome === "skipped-unsupported") {
          report.outbox.skippedUnsupported += 1
        }
      }
    }
  }

  if (inboxRepo?.countWebhookInboxByStatus) {
    report.inbox.backlog = await inboxRepo.countWebhookInboxByStatus()
  }
  if (outboxRepo?.countOutboxEventsByStatus) {
    report.outbox.backlog = await outboxRepo.countOutboxEventsByStatus()
  }

  return report
}
