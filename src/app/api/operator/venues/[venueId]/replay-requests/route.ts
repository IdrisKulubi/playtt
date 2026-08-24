import { type NextRequest } from "next/server"

import { getSessionWithBearerFallback } from "@/lib/security"
import { getVenueEdgeCapacityForLocation } from "@/server/devices/devices-service"
import { canAccessOperatorShell } from "@/server/operator/access.mjs"
import { isOperatorShellEnabledForTenant } from "@/server/operator/feature-policy"
import {
  mapOperatorError,
  operatorError,
  operatorJson,
} from "@/server/operator/http"
import { mapReplayServiceError } from "@/server/replays/http"
import { listReplayRequestsForOperator } from "@/server/replays/replay-requests-service"
import { resolveTenantContextForSessionUser } from "@/server/tenancy/session-context"

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ venueId: string }> },
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
        message: "You do not have permission to view replay requests.",
        status: 403,
      })
    }

    const { venueId } = await context.params
    const replayRequests = await listReplayRequestsForOperator(
      tenantContext,
      venueId,
    )
    const edgeCapacity = await getVenueEdgeCapacityForLocation(
      tenantContext,
      venueId,
    )

    return operatorJson({
      replayRequests: replayRequests.map((request) => ({
        id: request.id,
        resourceId: request.resourceId,
        resourceName: request.resourceName,
        status: request.status,
        failureReason: request.failureReason,
        attempts: request.attempts,
        maxAttempts: request.maxAttempts,
        createdAt: request.createdAt.toISOString(),
        updatedAt: request.updatedAt.toISOString(),
      })),
      edgeCapacity,
    })
  } catch (error) {
    if (error instanceof Error && error.name === "ReplayServiceError") {
      return mapReplayServiceError(error)
    }

    return mapOperatorError(error)
  }
}
