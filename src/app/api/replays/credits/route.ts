import { type NextRequest } from "next/server"

import { getSessionWithBearerFallback } from "@/lib/security"
import {
  mapReplayServiceError,
  replayError,
  replayJson,
} from "@/server/replays/http"
import { getReplayCreditsStatus } from "@/server/replays/service"

export async function GET(req: NextRequest) {
  const session = await getSessionWithBearerFallback(req)

  if (!session) {
    return replayError({
      code: "UNAUTHENTICATED",
      message: "Sign in is required.",
      status: 401,
    })
  }

  try {
    const credits = await getReplayCreditsStatus(session.user.id)
    return replayJson({ credits })
  } catch (error) {
    return mapReplayServiceError(error)
  }
}
