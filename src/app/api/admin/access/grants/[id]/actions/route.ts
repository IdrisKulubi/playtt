import { type NextRequest } from "next/server"
import { z } from "zod/v3"

import { resolveAccessAdminContext } from "@/server/access/admin-api-context"
import {
  reconcileAccessGrant,
  retryAccessGrant,
  revokeAccessGrant,
} from "@/server/access/admin-service"
import { mapOperatorError, operatorJson } from "@/server/operator/http"

const actionSchema = z.object({
  action: z.enum(["retry", "reconcile", "revoke"]),
  reason: z.string().trim().min(3).max(500).optional(),
})

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, routeContext: RouteContext) {
  try {
    const resolved = await resolveAccessAdminContext(req)
    if ("error" in resolved) return resolved.error
    const { id: grantId } = await routeContext.params
    const input = actionSchema.parse(await req.json())
    const operationInput = { grantId, reason: input.reason }

    const grant =
      input.action === "retry"
        ? await retryAccessGrant(resolved.context, operationInput)
        : input.action === "reconcile"
          ? await reconcileAccessGrant(resolved.context, operationInput)
          : await revokeAccessGrant(resolved.context, operationInput)

    return operatorJson({ grant })
  } catch (error) {
    return mapOperatorError(error)
  }
}
