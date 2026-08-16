import { type NextRequest } from "next/server"

import { getSessionWithBearerFallback } from "@/lib/security"
import {
  coachError,
  coachJson,
  mapCoachServiceError,
} from "@/server/coach/http"
import { getCoachInsightDetail } from "@/server/coach/service"

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSessionWithBearerFallback(req)

    if (!session) {
      return coachError({
        code: "UNAUTHENTICATED",
        message: "Sign in is required.",
        status: 401,
      })
    }

    const { id } = await context.params
    const result = await getCoachInsightDetail({
      userId: session.user.id,
      insightId: id,
    })
    return coachJson(result)
  } catch (error) {
    return mapCoachServiceError(error)
  }
}
