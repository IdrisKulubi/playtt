import { type NextRequest } from "next/server"

import { getSessionWithBearerFallback } from "@/lib/security"
import {
  mapMediaServiceError,
  mediaError,
  mediaJson,
} from "@/server/media/http"
import { requestMediaDeletion } from "@/server/media/service"
import { resolveTenantContextForSessionUser } from "@/server/tenancy/session-context"

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ mediaId: string }> },
) {
  try {
    const session = await getSessionWithBearerFallback(req)

    if (!session) {
      return mediaError({
        code: "UNAUTHENTICATED",
        message: "Sign in is required.",
        status: 401,
      })
    }

    const { mediaId } = await context.params
    const tenantContext = await resolveTenantContextForSessionUser(
      session.user.id,
      req.headers.get("x-tenant-id"),
    )
    const result = await requestMediaDeletion({
      context: tenantContext,
      userId: session.user.id,
      mediaId,
    })

    return mediaJson(result)
  } catch (error) {
    return mapMediaServiceError(error)
  }
}
