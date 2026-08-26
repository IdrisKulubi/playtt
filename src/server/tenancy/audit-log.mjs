import postgres from "postgres"

import { requireTenantContext } from "./require-context.mjs"

function getDatabaseUrl() {
  const url = process.env.POSTGRES_URL?.replace(/^['"]+|['"]+$/g, "").trim()
  if (!url) {
    throw new Error("POSTGRES_URL is required for audit log writes.")
  }
  return url
}

export async function writeAuditLogWithClient(client, context, input) {
  const trustedContext = requireTenantContext(context)
  const [created] = await client`
    insert into audit_logs (
      tenant_id,
      actor_type,
      actor_id,
      action,
      target_type,
      target_id,
      metadata,
      correlation_id
    )
    values (
      ${trustedContext.tenantId},
      ${trustedContext.actor.type},
      ${trustedContext.actor.id},
      ${input.action},
      ${input.targetType ?? null},
      ${input.targetId ?? null},
      ${client.json(input.metadata ?? null)},
      ${trustedContext.correlationId}
    )
    returning
      id,
      tenant_id as "tenantId",
      action,
      target_type as "targetType",
      target_id as "targetId"
  `

  return created
}

export async function writeAuditLog(context, input) {
  const sql = postgres(getDatabaseUrl(), { max: 1 })

  try {
    return await writeAuditLogWithClient(sql, context, input)
  } finally {
    await sql.end({ timeout: 5 })
  }
}
