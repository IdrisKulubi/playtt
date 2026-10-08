import * as FileSystem from "expo-file-system/legacy"
import * as VideoThumbnails from "expo-video-thumbnails"
import { Platform } from "react-native"

import { USE_LIVE_ACTIVITY_CLIPS } from "@/lib/mock/mock-config"
import type { ReplaySummary } from "@/lib/replay-types"
import { resolveReplayPlaybackUrl } from "@/lib/replays-api"

const posterCache = new Map<string, string>()
const inFlight = new Map<string, Promise<string | null>>()

const MAX_CONCURRENT = 2
let activeJobs = 0
const slotWaiters: Array<() => void> = []

function acquireSlot() {
  if (activeJobs < MAX_CONCURRENT) {
    activeJobs += 1
    return Promise.resolve()
  }

  return new Promise<void>((resolve) => {
    slotWaiters.push(() => {
      activeJobs += 1
      resolve()
    })
  })
}

function releaseSlot() {
  activeJobs -= 1
  const next = slotWaiters.shift()
  next?.()
}

function playbackGrantStillValid(expiresAt?: string) {
  if (!expiresAt) {
    return true
  }
  return new Date(expiresAt).getTime() > Date.now() + 5000
}

function posterTimeMs(durationSeconds: number) {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    return 500
  }
  return Math.min(1500, Math.max(400, durationSeconds * 120))
}

function canExtractPoster(replay: ReplaySummary) {
  if (!USE_LIVE_ACTIVITY_CLIPS) {
    return false
  }
  if (replay.status === "failed" || replay.status === "queued") {
    return false
  }
  return true
}

async function extractThumbnailUri(videoUri: string, timeMs: number) {
  const { uri } = await VideoThumbnails.getThumbnailAsync(videoUri, {
    time: timeMs,
    quality: 0.8,
  })
  return uri
}

async function thumbnailFromPlaybackUrl(replay: ReplaySummary, remoteUrl: string) {
  const timeMs = posterTimeMs(replay.durationSeconds)
  const cachePath = `${FileSystem.cacheDirectory}replay-src-${replay.id}.mp4`
  const info = await FileSystem.getInfoAsync(cachePath)

  if (!info.exists) {
    const download = await FileSystem.downloadAsync(remoteUrl, cachePath)
    if (download.status !== 200) {
      throw new Error(`Clip download failed (${download.status}).`)
    }
  }

  const localUri =
    cachePath.startsWith("file://") ? cachePath : `file://${cachePath}`

  return extractThumbnailUri(localUri, timeMs)
}

async function capturePoster(replay: ReplaySummary) {
  if (replay.posterUrl && playbackGrantStillValid(replay.posterExpiresAt)) {
    return replay.posterUrl
  }

  await acquireSlot()
  try {
    const playbackUrl = await resolveReplayPlaybackUrl(replay)
    const uri = await thumbnailFromPlaybackUrl(replay, playbackUrl)
    posterCache.set(replay.id, uri)
    return uri
  } catch (error) {
    console.warn("[replay-poster] failed", replay.id, error)
    return null
  } finally {
    releaseSlot()
  }
}

/** Poster image URI (JPEG file or signed image URL), cached for the session. */
export function loadReplayPoster(
  replay: ReplaySummary,
): Promise<string | null> {
  if (Platform.OS === "web") {
    return Promise.resolve(null)
  }

  if (replay.posterUrl && playbackGrantStillValid(replay.posterExpiresAt)) {
    posterCache.set(replay.id, replay.posterUrl)
    return Promise.resolve(replay.posterUrl)
  }

  if (!canExtractPoster(replay)) {
    return Promise.resolve(null)
  }

  const cached = posterCache.get(replay.id)
  if (cached) {
    return Promise.resolve(cached)
  }

  const existing = inFlight.get(replay.id)
  if (existing) {
    return existing
  }

  const job = capturePoster(replay).finally(() => {
    inFlight.delete(replay.id)
  })
  inFlight.set(replay.id, job)
  return job
}

export function getCachedReplayPoster(replayId: string) {
  return posterCache.get(replayId) ?? null
}
