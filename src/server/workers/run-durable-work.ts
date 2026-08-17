import { createPaymentConfirmedEmailConsumers } from "@/server/payments/confirmation-email-consumer"
import { handlePaystackWebhookEvent } from "@/server/payments/service"
import {
  claimWebhookInboxWork,
  countWebhookInboxByStatus,
  markWebhookInboxProcessed,
  markWebhookInboxRetryOrDeadLetter,
} from "@/server/payments/webhook-inbox-repository"
import { createSessionLifecycleConsumers, reconcilePlaySessionLifecycle } from "@/server/sessions/lifecycle"
import { getRegisteredOutboxConsumers } from "@/server/workers/consumers.mjs"
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
    registry: {
      ...getRegisteredOutboxConsumers(),
      ...createPaymentConfirmedEmailConsumers(),
      ...createSessionLifecycleConsumers(),
    },
    reconcile: () => reconcilePlaySessionLifecycle(),
    outboxRounds: 6,
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
