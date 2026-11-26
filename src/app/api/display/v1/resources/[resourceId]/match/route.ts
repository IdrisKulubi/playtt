import { type NextRequest } from "next/server"

import { replayError, replayJson } from "@/server/replays/http"
import {
  endTableMatch,
  MatchControlError,
  startTableMatch,
} from "@/server/scoring/match-control"
import { runDurableWorkCycle } from "@/server/workers/run-durable-work"

type RouteContext = {
  params: Promise<{ resourceId: string }>
}

// The table tablet starts and ends matches. Same trust model as the kiosk's
// replay route: anyone at the table can use it while a session is active.

function drainSoon() {
  void runDurableWorkCycle().catch((error) => {
    console.error("Failed to drain durable work after match change", error)
  })
}

function mapError(error: unknown) {
  if (error instanceof MatchControlError) {
    return replayError({ code: error.code, message: error.message, status: error.status })
  }
  console.error("Match control failed", error)
  return replayError({
    code: "MATCH_ERROR",
    message: "Something went wrong. Try again.",
    status: 500,
  })
}

export async function POST(req: NextRequest, routeContext: RouteContext) {
  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return replayError({ code: "INVALID_BODY", message: "Invalid request body.", status: 400 })
  }

  try {
    const { resourceId } = await routeContext.params
    const result = await startTableMatch(resourceId, {
      mode: body.mode,
      sideA: body.sideA,
      sideB: body.sideB,
      bestOf: body.bestOf,
    })
    drainSoon()
    return replayJson(result, 201)
  } catch (error) {
    return mapError(error)
  }
}

export async function DELETE(_req: NextRequest, routeContext: RouteContext) {
  try {
    const { resourceId } = await routeContext.params
    const result = await endTableMatch(resourceId)
    drainSoon()
    return replayJson(result)
  } catch (error) {
    return mapError(error)
  }
}
