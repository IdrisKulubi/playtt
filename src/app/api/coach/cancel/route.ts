import { type NextRequest } from "next/server"

import { getSessionWithBearerFallback } from "@/lib/security"
import {
  coachError,
  coachJson,
  mapCoachServiceError,
} from "@/server/coach/http"
import { cancelCoachSubscription } from "@/server/coach/service"

export async function POST(req: NextRequest) {
  const session = await getSessionWithBearerFallback(req)

  if (!session) {
    return coachError({
      code: "UNAUTHENTICATED",
      message: "Sign in is required.",
      status: 401,
    })
  }

  try {
    const result = await cancelCoachSubscription(session.user.id)
    return coachJson(result)
  } catch (error) {
    return mapCoachServiceError(error)
  }
}
