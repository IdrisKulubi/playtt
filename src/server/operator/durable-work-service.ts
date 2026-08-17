import { z } from "zod"

import {
  getDeadLetterInboxForTenant,
  getDeadLetterOutboxForTenant,
  getOperatorDurableWorkOverview,
} from "@/server/operator/durable-work-repository"
import { replayWebhookInbox } from "@/server/payments/webhook-inbox-repository"
import { authorize } from "@/server/tenancy/authorize-context.mjs"
import { writeAuditLog } from "@/server/tenancy/audit-log.mjs"
import type { TenantContext } from "@/server/tenancy/types"
import { replayOutboxEvent } from "@/server/workers/outbox-repository"

const replaySchema = z.object({
  kind: z.enum(["inbox", "outbox"]),
  id: z.string().uuid(),
})

export async function getDurableWorkOverview(context: TenantContext) {
  authorize(context, "catalog.read")
  return getOperatorDurableWorkOverview(context)
}

export async function replayDurableWork(
  context: TenantContext,
  input: z.infer<typeof replaySchema>,
) {
  authorize(context, "catalog.manage")
  const payload = replaySchema.parse(input)

  if (payload.kind === "inbox") {
    const row = await getDeadLetterInboxForTenant(context, payload.id)

    if (!row) {
      return { replayed: false, reason: "inbox_not_found" as const }
    }

    const replayed = await replayWebhookInbox(payload.id)

    await writeAuditLog(context, {
      action: "durable_work.replay",
      targetType: "payment_webhook_inbox",
      targetId: payload.id,
      metadata: {
        kind: payload.kind,
      },
    })

    return { replayed: Boolean(replayed), kind: payload.kind, id: payload.id }
  }

  const row = await getDeadLetterOutboxForTenant(context, payload.id)

  if (!row) {
    return { replayed: false, reason: "outbox_not_found" as const }
  }

  const replayed = await replayOutboxEvent(payload.id)

  await writeAuditLog(context, {
    action: "durable_work.replay",
    targetType: "outbox_event",
    targetId: payload.id,
    metadata: {
      kind: payload.kind,
    },
  })

  return { replayed: Boolean(replayed), kind: payload.kind, id: payload.id }
}
