import { type NextRequest } from "next/server"

import { getSessionWithBearerFallback } from "@/lib/security"
import {
  coachError,
  coachJson,
  mapCoachServiceError,
} from "@/server/coach/http"
import { initiateCoachSubscribe } from "@/server/coach/service"
import { PaymentServiceError } from "@/server/payments/errors"
import { mapPaymentServiceError } from "@/server/payments/http"
import { resolveTenantContextForSessionUser } from "@/server/tenancy/session-context"

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionWithBearerFallback(req)

    if (!session) {
      return coachError({
        code: "UNAUTHENTICATED",
        message: "Sign in is required.",
        status: 401,
      })
    }

    const context = await resolveTenantContextForSessionUser(
      session.user.id,
      req.headers.get("x-tenant-id"),
    )
    const result = await initiateCoachSubscribe(context, session.user.id)
    return coachJson(result)
  } catch (error) {
    if (error instanceof PaymentServiceError) {
      return mapPaymentServiceError(error)
    }
    return mapCoachServiceError(error)
  }
}
