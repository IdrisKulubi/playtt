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
import { shouldAttachDisplayPlayback } from "@/server/replays/display-playback-hint"
import { getDisplayReplayPlaybackGrant } from "@/server/replays/playback"

const bodySchema = z.object({
  clientIdempotencyKey: z.string().trim().min(1),
})

type RouteContext = {
  params: Promise<{ resourceId: string }>
}

export async function GET(req: NextRequest, routeContext: RouteContext) {
  const { resourceId } = await routeContext.params
  const status = await getKioskReplayStatus(resourceId)

  if (!status) {
    return replayError({
      code: "RESOURCE_NOT_FOUND",
      message: "We could not find that resource.",
      status: 404,
    })
  }

  // The TV asks for the playback link up front (?playback=1) so it can start
  // a freshly ready clip without a second request. `seen` is the replay it
  // already played, so links aren't minted on every poll.
  const wantsPlayback = req.nextUrl.searchParams.get("playback") === "1"
  const seenReplayId = req.nextUrl.searchParams.get("seen")
  const latest =
    status.latestReplay && !wantsPlayback
      ? // Venue-LAN links are for the TV only.
        { ...status.latestReplay, localPlayback: null }
      : status.latestReplay
  const publicStatus = { ...status, latestReplay: latest }

  if (
    wantsPlayback &&
    latest &&
    shouldAttachDisplayPlayback({
      latestReplay: latest,
      seenReplayId,
      nowMs: Date.now(),
    })
  ) {
    try {
      const playback = await getDisplayReplayPlaybackGrant({
        resourceId,
        replayId: latest.replayId!,
      })
      return replayJson({
        ...publicStatus,
        latestReplay: {
          ...latest,
          playback: {
            replayId: playback.replayId,
            mediaId: playback.mediaId,
            durationSeconds: playback.durationSeconds,
            url: playback.grant.url,
            expiresAt: playback.grant.expiresAt,
          },
        },
      })
    } catch {
      // The TV falls back to the playback endpoint.
    }
  }

  return replayJson(publicStatus)
}

export async function POST(req: NextRequest, routeContext: RouteContext) {
  // Taken first so the clip lines up with the tap, not with our DB round trips.
  const requestedAt = new Date()
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
      requestedAt,
    })

    return replayJson(result, 201)
  } catch (error) {
    return mapReplayServiceError(error)
  }
}
