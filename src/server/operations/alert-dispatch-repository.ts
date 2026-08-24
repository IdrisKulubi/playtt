import { and, desc, eq, gte, inArray } from "drizzle-orm"

import db from "@/db/drizzle"
import { auditLogs } from "@/db/schema"
import {
  OPERATIONAL_ALERT_DISPATCH_ACTION,
  OPERATIONAL_ALERT_DISPATCH_FAILED_ACTION,
  type AlertDispatchAuditEntry,
} from "./alert-dispatch-types.ts"

export async function listRecentlyDispatchedAlertIds(
  tenantId: string,
  since: Date,
): Promise<Set<string>> {
  const rows = await db
    .select({ targetId: auditLogs.targetId })
    .from(auditLogs)
    .where(
      and(
        eq(auditLogs.tenantId, tenantId),
        eq(auditLogs.action, OPERATIONAL_ALERT_DISPATCH_ACTION),
        gte(auditLogs.createdAt, since),
      ),
    )

  return new Set(
    rows
      .map((row) => row.targetId)
      .filter((targetId): targetId is string => Boolean(targetId)),
  )
}

export async function listRecentAlertDispatchAudit(
  tenantId: string,
  limit = 10,
): Promise<AlertDispatchAuditEntry[]> {
  const rows = await db
    .select({
      targetId: auditLogs.targetId,
      action: auditLogs.action,
      createdAt: auditLogs.createdAt,
      metadata: auditLogs.metadata,
    })
    .from(auditLogs)
    .where(
      and(
        eq(auditLogs.tenantId, tenantId),
        inArray(auditLogs.action, [
          OPERATIONAL_ALERT_DISPATCH_ACTION,
          OPERATIONAL_ALERT_DISPATCH_FAILED_ACTION,
        ]),
      ),
    )
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit)

  return rows
    .filter((row) => Boolean(row.targetId))
    .map((row) => {
      const metadata = row.metadata ?? {}

      return {
        alertId: row.targetId!,
        action: row.action,
        dispatchedAt: row.createdAt.toISOString(),
        success: row.action === OPERATIONAL_ALERT_DISPATCH_ACTION,
        channel:
          typeof metadata.channel === "string" ? metadata.channel : null,
        error: typeof metadata.error === "string" ? metadata.error : null,
      }
    })
}
