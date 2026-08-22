import { type NextRequest } from "next/server"
import { z } from "zod/v3"

import {
  mapReplayServiceError,
  replayError,
  replayJson,
} from "@/server/replays/http"
import {
  createKioskReplayRequest,
  getKioskReplayStatus,
} from "@/server/replays/replay-requests-service"

const bodySchema = z.object({
  clientIdempotencyKey: z.string().trim().min(1),
})

type RouteContext = {
  params: Promise<{ resourceId: string }>
}

export async function GET(_req: NextRequest, routeContext: RouteContext) {
  const { resourceId } = await routeContext.params
  const status = await getKioskReplayStatus(resourceId)

  if (!status) {
    return replayError({
      code: "RESOURCE_NOT_FOUND",
      message: "We could not find that resource.",
      status: 404,
    })
  }

  return replayJson(status)
}

export async function POST(req: NextRequest, routeContext: RouteContext) {
  try {
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
    const { resourceId } = await routeContext.params
    const result = await createKioskReplayRequest({
      resourceId,
      clientIdempotencyKey: body.clientIdempotencyKey,
    })

    return replayJson(result, 201)
  } catch (error) {
    return mapReplayServiceError(error)
  }
}
