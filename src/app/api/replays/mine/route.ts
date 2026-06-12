import { type NextRequest } from "next/server"

import { getSessionWithBearerFallback } from "@/lib/security"
import {
  mapReplayServiceError,
  replayError,
  replayJson,
} from "@/server/replays/http"
import { listUserReplays } from "@/server/replays/service"

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
    const replays = await listUserReplays(session.user.id)
    return replayJson({ replays })
  } catch (error) {
    return mapReplayServiceError(error)
  }
}
