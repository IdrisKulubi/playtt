import { type NextRequest } from "next/server"
import { z } from "zod/v3"

import { getSessionWithBearerFallback } from "@/lib/security"
import { processReplayPipeline } from "@/server/coach/analysis"
import {
  mapReplayServiceError,
  replayError,
  replayJson,
} from "@/server/replays/http"
import { requestReplayCapture } from "@/server/replays/service"
import { shouldAutoRunReplayStub } from "@/server/replays/stub-policy"
import { resolveTenantContextForSessionUser } from "@/server/tenancy/session-context"

const bodySchema = z.object({
  bookingId: z.string().uuid(),
})

export async function POST(req: NextRequest) {
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
    const context = await resolveTenantContextForSessionUser(
      session.user.id,
      req.headers.get("x-tenant-id"),
    )
    const result = await requestReplayCapture({
      context,
      userId: session.user.id,
      bookingId: body.bookingId,
    })

    if (
      shouldAutoRunReplayStub({
        environment: process.env.NODE_ENV,
        flag: process.env.NVR_STUB_AUTO,
      })
    ) {
      await processReplayPipeline(result.replayId)
    }

    return replayJson(result)
  } catch (error) {
    return mapReplayServiceError(error)
  }
}
