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

const bodySchema = z.object({
  bookingId: z.string().uuid(),
})

export async function POST(req: NextRequest) {
  const session = await getSessionWithBearerFallback(req)

  if (!session) {
    return replayError({
      code: "UNAUTHENTICATED",
      message: "Sign in is required.",
      status: 401,
    })
  }

  try {
    const body = bodySchema.parse(await req.json())
    const result = await requestReplayCapture({
      userId: session.user.id,
      bookingId: body.bookingId,
    })

    if (process.env.NVR_STUB_AUTO === "true") {
      await processReplayPipeline(result.replayId)
    }

    return replayJson(result)
  } catch (error) {
    return mapReplayServiceError(error)
  }
}
