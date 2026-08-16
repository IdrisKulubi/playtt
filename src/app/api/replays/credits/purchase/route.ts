import { type NextRequest } from "next/server"

import { getSessionWithBearerFallback } from "@/lib/security"
import { PaymentServiceError } from "@/server/payments/errors"
import { mapPaymentServiceError } from "@/server/payments/http"
import {
  mapReplayServiceError,
  replayError,
  replayJson,
} from "@/server/replays/http"
import { initiateReplayPackPurchase } from "@/server/replays/service"

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

    const result = await initiateReplayPackPurchase(session.user.id)
    return replayJson(result)
  } catch (error) {
    if (error instanceof PaymentServiceError) {
      return mapPaymentServiceError(error)
    }
    return mapReplayServiceError(error)
  }
}
