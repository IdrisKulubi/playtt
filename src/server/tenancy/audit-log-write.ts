import { auditLogs } from "@/db/schema"
import db from "@/db/drizzle"
import type { TenantContext } from "@/server/tenancy/types"

export interface AuditLogWriteInput {
  action: string
  targetType?: string | null
  targetId?: string | null
  metadata?: Record<string, unknown> | null
}

export type AuditLogTransaction = Parameters<
  Parameters<typeof db.transaction>[0]
>[0]

function requireTenantContext(context: TenantContext): TenantContext {
  if (!context?.tenantId || !context.actor?.type || !context.actor?.id) {
    throw new Error("Tenant context is required for audit log writes.")
  }

  if (!context.correlationId) {
    throw new Error("Tenant context correlationId is required for audit log writes.")
  }

  return context
}

export async function writeAuditLogInTransaction(
  tx: AuditLogTransaction,
  context: TenantContext,
  input: AuditLogWriteInput,
) {
  const trustedContext = requireTenantContext(context)
  const [created] = await tx
    .insert(auditLogs)
    .values({
      tenantId: trustedContext.tenantId,
      actorType: trustedContext.actor.type,
      actorId: trustedContext.actor.id,
      action: input.action,
      targetType: input.targetType ?? null,
      targetId: input.targetId ?? null,
      metadata: input.metadata ?? null,
      correlationId: trustedContext.correlationId,
    })
    .returning({ id: auditLogs.id })

  return created
}

export async function writeAuditLog(
  context: TenantContext,
  input: AuditLogWriteInput,
) {
  return db.transaction(async (tx) =>
    writeAuditLogInTransaction(tx, context, input),
  )
}
