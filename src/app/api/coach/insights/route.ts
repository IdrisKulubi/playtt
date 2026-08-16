import { type NextRequest } from "next/server"

import { getSessionWithBearerFallback } from "@/lib/security"
import {
  coachError,
  coachJson,
  mapCoachServiceError,
} from "@/server/coach/http"
import { getCoachInsightsForUser } from "@/server/coach/service"

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionWithBearerFallback(req)

    if (!session) {
      return coachError({
        code: "UNAUTHENTICATED",
        message: "Sign in is required.",
        status: 401,
      })
    }

    const insights = await getCoachInsightsForUser(session.user.id)
    return coachJson({ insights })
  } catch (error) {
    return mapCoachServiceError(error)
  }
}
