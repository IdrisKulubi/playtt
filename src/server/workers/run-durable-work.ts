import { handlePaystackWebhookEvent } from "@/server/payments/service"
import {
  claimWebhookInboxWork,
  countWebhookInboxByStatus,
  markWebhookInboxProcessed,
  markWebhookInboxRetryOrDeadLetter,
} from "@/server/payments/webhook-inbox-repository"
import {
  claimOutboxWork,
  countOutboxEventsByStatus,
  markOutboxProcessed,
  markOutboxRetryOrDeadLetter,
} from "@/server/workers/outbox-repository"
import { runDurableWork } from "@/server/workers/run-durable-work.mjs"

export async function runDurableWorkCycle() {
  return runDurableWork({
    handleEvent: handlePaystackWebhookEvent,
    inboxRepository: {
      claimWebhookInboxWork,
      markWebhookInboxProcessed,
      markWebhookInboxRetryOrDeadLetter,
      countWebhookInboxByStatus,
    },
    outboxRepository: {
      claimOutboxWork,
      markOutboxProcessed,
      markOutboxRetryOrDeadLetter,
      countOutboxEventsByStatus,
    },
  })
}
