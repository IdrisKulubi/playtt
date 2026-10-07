import { type NextRequest } from "next/server"

import { getSessionWithBearerFallback } from "@/lib/security"
import {
  mapReplayServiceError,
  replayError,
  replayJson,
} from "@/server/replays/http"
import { deleteUserReplay } from "@/server/replays/service"
import { resolveTenantContextForSessionUser } from "@/server/tenancy/session-context"

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSessionWithBearerFallback(req)

    if (!session) {
      return replayError({
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
    const result = await deleteUserReplay(
      tenantContext,
      session.user.id,
      id,
    )

    return replayJson({ replay: result })
  } catch (error) {
    return mapReplayServiceError(error)
  }
}
