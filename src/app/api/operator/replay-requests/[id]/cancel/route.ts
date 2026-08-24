import { type NextRequest } from "next/server"
import { z } from "zod/v3"

import { getSessionWithBearerFallback } from "@/lib/security"
import { canAccessOperatorShell } from "@/server/operator/access.mjs"
import { isOperatorShellEnabledForTenant } from "@/server/operator/feature-policy"
import {
  mapOperatorError,
  operatorError,
  operatorJson,
} from "@/server/operator/http"
import { mapReplayServiceError } from "@/server/replays/http"
import { cancelReplayRequestForOperator } from "@/server/replays/replay-requests-service"
import { canPerformTenantAction } from "@/server/tenancy/permissions"
import { resolveTenantContextForSessionUser } from "@/server/tenancy/session-context"

const cancelSchema = z.object({
  reason: z.string().trim().max(200).optional(),
})

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSessionWithBearerFallback(req)

    if (!session) {
      return operatorError({
        code: "UNAUTHENTICATED",
        message: "Sign in is required.",
        status: 401,
      })
    }

    const tenantContext = await resolveTenantContextForSessionUser(
      session.user.id,
      req.headers.get("x-tenant-id"),
    )

    if (!(await isOperatorShellEnabledForTenant(tenantContext))) {
      return operatorError({
        code: "FORBIDDEN_ACTION",
        message: "Operator shell is not enabled for this tenant.",
        status: 403,
      })
    }

    if (!canAccessOperatorShell(tenantContext.role)) {
      return operatorError({
        code: "FORBIDDEN_ACTION",
        message: "You do not have permission to cancel replay requests.",
        status: 403,
      })
    }

    if (!canPerformTenantAction(tenantContext.role, "venue.manage")) {
      return operatorError({
        code: "FORBIDDEN_ACTION",
        message: "You do not have permission to cancel replay requests.",
        status: 403,
      })
    }

    const { id } = await context.params
    const body = cancelSchema.parse(
      req.headers.get("content-length") === "0" ? {} : await req.json(),
    )
    const result = await cancelReplayRequestForOperator(
      tenantContext,
      id,
      body.reason ?? "operator_cancelled",
    )

    return operatorJson({
      replayRequest: {
        id: result.replayRequest.id,
        status: result.replayRequest.status,
        failureReason: result.replayRequest.failureReason,
        updatedAt: result.replayRequest.updatedAt.toISOString(),
      },
    })
  } catch (error) {
    if (error instanceof Error && error.name === "ReplayServiceError") {
      return mapReplayServiceError(error)
    }

    return mapOperatorError(error)
  }
}
