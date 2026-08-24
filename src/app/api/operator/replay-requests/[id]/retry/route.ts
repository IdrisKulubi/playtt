import { type NextRequest } from "next/server"

import { getSessionWithBearerFallback } from "@/lib/security"
import { canAccessOperatorShell } from "@/server/operator/access.mjs"
import { isOperatorShellEnabledForTenant } from "@/server/operator/feature-policy"
import {
  mapOperatorError,
  operatorError,
  operatorJson,
} from "@/server/operator/http"
import { mapReplayServiceError } from "@/server/replays/http"
import { retryReplayRequestForOperator } from "@/server/replays/replay-requests-service"
import { canPerformTenantAction } from "@/server/tenancy/permissions"
import { resolveTenantContextForSessionUser } from "@/server/tenancy/session-context"

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
        message: "You do not have permission to retry replay requests.",
        status: 403,
      })
    }

    if (!canPerformTenantAction(tenantContext.role, "venue.manage")) {
      return operatorError({
        code: "FORBIDDEN_ACTION",
        message: "You do not have permission to retry replay requests.",
        status: 403,
      })
    }

    const { id } = await context.params
    const result = await retryReplayRequestForOperator(tenantContext, id)

    return operatorJson({
      replayRequest: {
        id: result.replayRequest.id,
        status: result.replayRequest.status,
        attempts: result.replayRequest.attempts,
        failureReason: result.replayRequest.failureReason,
        updatedAt: result.replayRequest.updatedAt.toISOString(),
      },
      commandId: result.commandId,
    })
  } catch (error) {
    if (error instanceof Error && error.name === "ReplayServiceError") {
      return mapReplayServiceError(error)
    }

    return mapOperatorError(error)
  }
}
