import { createPaymentConfirmedEmailConsumers } from "@/server/payments/confirmation-email-consumer"
import {
  expireStaleDeviceCommands,
  failExhaustedDeviceCommands,
} from "@/server/devices/commands"
import { pruneAllDeviceHeartbeatHistory } from "@/server/devices/heartbeats"
import { handlePaystackWebhookEvent } from "@/server/payments/service"
import {
  claimWebhookInboxWork,
  countWebhookInboxByStatus,
  markWebhookInboxProcessed,
  markWebhookInboxRetryOrDeadLetter,
} from "@/server/payments/webhook-inbox-repository"
import {
  createSessionLifecycleConsumers,
  reconcilePlaySessionLifecycle,
} from "@/server/sessions/lifecycle"
import { createScoreUpdatedConsumers } from "@/server/realtime/score-updated-consumer"
import { createReplayReadyConsumers } from "@/server/replays/replay-ready-consumer"
import { createMediaDeleteConsumers } from "@/server/media/delete-consumer"
import { reconcileMediaStorage } from "@/server/media/reconcile"
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
      ...createScoreUpdatedConsumers(),
      ...createReplayReadyConsumers(),
      ...createMediaDeleteConsumers(),
    },
    reconcile: async () => {
      const [sessions, expiredCommands, failedCommands, prunedHeartbeats, media] =
        await Promise.all([
          reconcilePlaySessionLifecycle(),
          expireStaleDeviceCommands(),
          failExhaustedDeviceCommands(),
          pruneAllDeviceHeartbeatHistory(),
          reconcileMediaStorage(),
        ])

      return {
        sessions,
        devices: {
          expiredCommands,
          failedCommands,
          prunedHeartbeats,
        },
        media,
      }
    },
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
