import { z } from "zod"

import { listRecentlyAcknowledgedAlertIds } from "@/server/operations/alert-actions-repository.ts"
import { OPERATIONAL_ALERT_ACKNOWLEDGED_ACTION } from "@/server/operations/alert-actions-types.ts"
import { authorize } from "@/server/tenancy/authorize-context.mjs"
import { writeAuditLog } from "@/server/tenancy/audit-log.mjs"
import type { TenantContext } from "@/server/tenancy/types"

const acknowledgeSchema = z.object({
  alertId: z.string().min(1),
  note: z.string().trim().max(500).optional(),
})

const ACKNOWLEDGEMENT_WINDOW_MS = 24 * 60 * 60 * 1000

export async function acknowledgeOperationalAlert(
  context: TenantContext,
  input: z.infer<typeof acknowledgeSchema>,
) {
  authorize(context, "venue.read")
  const payload = acknowledgeSchema.parse(input)
  const since = new Date(Date.now() - ACKNOWLEDGEMENT_WINDOW_MS)
  const acknowledged = await listRecentlyAcknowledgedAlertIds(
    context.tenantId,
    since,
  )

  if (acknowledged.has(payload.alertId)) {
    return {
      acknowledged: true,
      alertId: payload.alertId,
      duplicate: true,
    }
  }

  await writeAuditLog(context, {
    action: OPERATIONAL_ALERT_ACKNOWLEDGED_ACTION,
    targetType: "operational_alert",
    targetId: payload.alertId,
    metadata: {
      note: payload.note ?? null,
      actorRole: context.role ?? null,
    },
  })

  return {
    acknowledged: true,
    alertId: payload.alertId,
    duplicate: false,
  }
}

export async function listAcknowledgedAlertIds(context: TenantContext) {
  authorize(context, "venue.read")

  const since = new Date(Date.now() - ACKNOWLEDGEMENT_WINDOW_MS)
  const acknowledged = await listRecentlyAcknowledgedAlertIds(
    context.tenantId,
    since,
  )

  return [...acknowledged]
}
