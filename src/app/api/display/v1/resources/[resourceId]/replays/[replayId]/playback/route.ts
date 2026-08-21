import { type NextRequest } from "next/server"

import { mapReplayServiceError, replayJson } from "@/server/replays/http"
import { getDisplayReplayPlaybackGrant } from "@/server/replays/playback"

type RouteContext = {
  params: Promise<{ resourceId: string; replayId: string }>
}

export async function GET(_req: NextRequest, routeContext: RouteContext) {
  try {
    const { resourceId, replayId } = await routeContext.params
    const playback = await getDisplayReplayPlaybackGrant({
      resourceId,
      replayId,
    })

    return replayJson({
      playback: {
        replayId: playback.replayId,
        mediaId: playback.mediaId,
        url: playback.grant.url,
        expiresAt: playback.grant.expiresAt,
      },
    })
  } catch (error) {
    return mapReplayServiceError(error)
  }
}
