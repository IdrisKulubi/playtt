import { NextResponse, type NextRequest } from "next/server"

import { mapReplayServiceError } from "@/server/replays/http"
import { processReplayReadyCallback } from "@/server/replays/ready-callback"
import { markReplayReady } from "@/server/replays/service"

/** Internal/hardware callback when NVR upload completes. */
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params
    const result = await processReplayReadyCallback({
      configuredSecret: process.env.REPLAY_WEBHOOK_SECRET,
      markReady: markReplayReady,
      providedSecret: req.headers.get("x-playtt-replay-secret"),
      rawBody: await req.text(),
      replayId: id,
    })

    return NextResponse.json(result.body, { status: result.status })
  } catch (error) {
    return mapReplayServiceError(error)
  }
}
