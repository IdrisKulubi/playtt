import { type NextRequest } from "next/server"
import { z } from "zod/v3"

import {
  mapReplayServiceError,
  replayError,
  replayJson,
} from "@/server/replays/http"
import { markReplayReady } from "@/server/replays/service"

const bodySchema = z.object({
  videoUrl: z.string().url(),
  title: z.string().optional(),
})

/** Internal/hardware callback when NVR upload completes. */
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const secret = process.env.REPLAY_WEBHOOK_SECRET?.trim()
  const provided = req.headers.get("x-playtt-replay-secret")

  if (!secret || provided !== secret) {
    return replayError({
      code: "UNAUTHORIZED",
      message: "Invalid replay webhook secret.",
      status: 401,
    })
  }

  try {
    const { id } = await context.params
    const body = bodySchema.parse(await req.json())
    const replay = await markReplayReady({
      replayId: id,
      videoUrl: body.videoUrl,
      title: body.title,
    })
    return replayJson({ replay })
  } catch (error) {
    return mapReplayServiceError(error)
  }
}
