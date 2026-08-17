import { type NextRequest } from "next/server"

import { getSessionWithBearerFallback } from "@/lib/security"
import {
  mapReplayServiceError,
  replayError,
  replayJson,
} from "@/server/replays/http"
import { listUserReplays } from "@/server/replays/service"
import { resolveTenantContextForSessionUser } from "@/server/tenancy/session-context"

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionWithBearerFallback(req)

    if (!session) {
      return replayError({
        code: "UNAUTHENTICATED",
        message: "Sign in is required.",
        status: 401,
      })
    }

    const context = await resolveTenantContextForSessionUser(
      session.user.id,
      req.headers.get("x-tenant-id"),
    )
    const replays = await listUserReplays(context, session.user.id)
    return replayJson({ replays })
  } catch (error) {
    return mapReplayServiceError(error)
  }
}
