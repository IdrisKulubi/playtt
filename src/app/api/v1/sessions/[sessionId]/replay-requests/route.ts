import { type NextRequest } from "next/server"
import { z } from "zod/v3"

import { getSessionWithBearerFallback } from "@/lib/security"
import {
  mapReplayServiceError,
  replayError,
  replayJson,
} from "@/server/replays/http"
import { createReplayRequest } from "@/server/replays/replay-requests-service"
import { resolveTenantContextForSessionUser } from "@/server/tenancy/session-context"

const bodySchema = z.object({
  clientIdempotencyKey: z.string().trim().min(1),
})

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ sessionId: string }> },
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

    let requestBody: unknown

    try {
      requestBody = await req.json()
    } catch {
      return replayError({
        code: "INVALID_BODY",
        message: "Invalid request body.",
        status: 400,
      })
    }

    const body = bodySchema.parse(requestBody)
    const { sessionId } = await context.params
    const tenantContext = await resolveTenantContextForSessionUser(
      session.user.id,
      req.headers.get("x-tenant-id"),
    )
    const result = await createReplayRequest({
      context: tenantContext,
      userId: session.user.id,
      playSessionId: sessionId,
      clientIdempotencyKey: body.clientIdempotencyKey,
    })

    return replayJson(result, 201)
  } catch (error) {
    return mapReplayServiceError(error)
  }
}
