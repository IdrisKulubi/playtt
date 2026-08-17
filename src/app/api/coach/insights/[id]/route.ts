import { type NextRequest } from "next/server"

import { getSessionWithBearerFallback } from "@/lib/security"
import {
  coachError,
  coachJson,
  mapCoachServiceError,
} from "@/server/coach/http"
import { getCoachInsightDetail } from "@/server/coach/service"
import { resolveTenantContextForSessionUser } from "@/server/tenancy/session-context"

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSessionWithBearerFallback(req)

    if (!session) {
      return coachError({
        code: "UNAUTHENTICATED",
        message: "Sign in is required.",
        status: 401,
      })
    }

    const { id } = await context.params
    const tenantContext = await resolveTenantContextForSessionUser(
      session.user.id,
      req.headers.get("x-tenant-id"),
    )
    const result = await getCoachInsightDetail({
      context: tenantContext,
      userId: session.user.id,
      insightId: id,
    })
    return coachJson(result)
  } catch (error) {
    return mapCoachServiceError(error)
  }
}
