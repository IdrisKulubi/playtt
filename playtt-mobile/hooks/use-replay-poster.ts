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

export function useReplayPoster(
  replay: ReplaySummary | null,
  enabled: boolean,
) {
  const [posterUri, setPosterUri] = useState<string | null>(() =>
    replay ? posterFromReplay(replay) : null,
  )

  useEffect(() => {
    if (!replay || !enabled) {
      return
    }

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
    enabled,
    replay?.id,
    replay?.status,
    replay?.posterUrl,
    replay?.posterExpiresAt,
    replay?.videoUrl,
    replay?.playbackExpiresAt,
    replay?.durationSeconds,
  ])

  return enabled ? posterUri : null
}
