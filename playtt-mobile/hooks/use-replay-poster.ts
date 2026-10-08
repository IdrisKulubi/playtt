import { useEffect, useState } from "react"

import {
  getCachedReplayPoster,
  loadReplayPoster,
} from "@/lib/replay-poster"
import type { ReplaySummary } from "@/lib/replay-types"

function posterFromReplay(replay: ReplaySummary) {
  if (!replay.posterUrl) {
    return getCachedReplayPoster(replay.id)
  }

  if (
    !replay.posterExpiresAt ||
    new Date(replay.posterExpiresAt).getTime() > Date.now() + 5000
  ) {
    return replay.posterUrl
  }

  return getCachedReplayPoster(replay.id)
}

export function useReplayPoster(replay: ReplaySummary) {
  const [posterUri, setPosterUri] = useState<string | null>(() =>
    posterFromReplay(replay),
  )

  useEffect(() => {
    const immediate = posterFromReplay(replay)
    if (immediate) {
      setPosterUri(immediate)
      return
    }

    let cancelled = false
    void loadReplayPoster(replay).then((uri) => {
      if (!cancelled && uri) {
        setPosterUri(uri)
      }
    })

    return () => {
      cancelled = true
    }
  }, [
    replay.id,
    replay.status,
    replay.posterUrl,
    replay.posterExpiresAt,
    replay.videoUrl,
    replay.playbackExpiresAt,
    replay.durationSeconds,
  ])

  return posterUri
}
