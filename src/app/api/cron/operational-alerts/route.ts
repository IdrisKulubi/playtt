import { type NextRequest } from "next/server"

import { dispatchOperationalAlerts } from "@/server/operations/alert-dispatch-service"
import { PLAYTT_TENANT_ID } from "@/server/tenancy/constants"
import { createServiceTenantContext } from "@/server/tenancy/context-factory.mjs"
import type { TenantContext } from "@/server/tenancy/types"

export const runtime = "nodejs"

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET?.trim()
  const authHeader = req.headers.get("authorization")

  if (process.env.NODE_ENV === "production" && !cronSecret) {
    console.error("[OPERATIONAL ALERTS CRON] CRON_SECRET is not configured")
    return new Response("Service unavailable", { status: 503 })
  }

  if (cronSecret) {
    if (authHeader !== `Bearer ${cronSecret}`) {
      return new Response("Unauthorized", { status: 401 })
    }
  }

  const context = createServiceTenantContext({
    tenantId: PLAYTT_TENANT_ID,
    actorId: "operational-alerts-cron",
    correlationId: `operational-alerts:${Date.now()}`,
  }) as TenantContext

  const report = await dispatchOperationalAlerts(context)
  return Response.json(report)
}
