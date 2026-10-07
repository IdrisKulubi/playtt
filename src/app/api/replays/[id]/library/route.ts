import { type NextRequest } from "next/server"
import { z } from "zod"

import { getSessionWithBearerFallback } from "@/lib/security"
import {
  mapReplayServiceError,
  replayError,
  replayJson,
} from "@/server/replays/http"
import { updateReplayFavorite } from "@/server/replays/service"
import { resolveTenantContextForSessionUser } from "@/server/tenancy/session-context"

const bodySchema = z.object({
  favorite: z.boolean(),
})

export async function PATCH(
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
    const parsed = bodySchema.safeParse(await req.json())

    if (!parsed.success) {
      return replayError({
        code: "INVALID_BODY",
        message: "Invalid request body.",
        status: 400,
      })
    }

    const tenantContext = await resolveTenantContextForSessionUser(
      session.user.id,
      req.headers.get("x-tenant-id"),
    )
    const result = await updateReplayFavorite(
      tenantContext,
      session.user.id,
      id,
      parsed.data.favorite,
    )

    return replayJson({ replay: result })
  } catch (error) {
    return mapReplayServiceError(error)
  }
}
