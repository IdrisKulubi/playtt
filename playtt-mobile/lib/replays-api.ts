import { apiFetch } from "@/lib/api-client"
import type { ReplaySummary, ReplayStatus } from "@/lib/replay-types"
import { USE_LIVE_ACTIVITY_CLIPS } from "@/lib/mock/mock-config"
import { MOCK_REPLAYS } from "@/lib/mock/mock-replays"

type ReplayMineRow = {
  id: string
  title: string
  recordedAt: string
  durationSeconds: number
  locationName: string
  status: string
  videoUrl?: string
  posterUrl?: string
  posterExpiresAt?: string
  bookingId?: string
  mediaId?: string
  playbackExpiresAt?: string
  isFavorite?: boolean
}

type ReplaysMineResponse = {
  data?: {
    replays?: ReplayMineRow[]
  }
}

function normalizeReplayStatus(status: string): ReplayStatus {
  if (
    status === "queued" ||
    status === "processing" ||
    status === "ready" ||
    status === "failed"
  ) {
    return status
  }

  return "unknown"
}

function mapReplay(row: ReplayMineRow): ReplaySummary {
  return {
    id: row.id,
    title: row.title,
    recordedAt: row.recordedAt,
    durationSeconds: row.durationSeconds,
    locationName: row.locationName,
    status: normalizeReplayStatus(row.status),
    videoUrl: row.videoUrl,
    posterUrl: row.posterUrl,
    posterExpiresAt: row.posterExpiresAt,
    bookingId: row.bookingId,
    mediaId: row.mediaId,
    playbackExpiresAt: row.playbackExpiresAt,
    isFavorite: row.isFavorite ?? false,
  }
}

export async function patchReplayFavorite(
  replayId: string,
  favorite: boolean,
): Promise<boolean> {
  const response = await apiFetch<{
    data?: { replay?: { isFavorite?: boolean } }
  }>(`/api/replays/${encodeURIComponent(replayId)}/library`, {
    method: "PATCH",
    body: JSON.stringify({ favorite }),
  })
  return response.data?.replay?.isFavorite ?? favorite
}

export async function archiveReplay(replayId: string): Promise<void> {
  await apiFetch(`/api/replays/${encodeURIComponent(replayId)}/archive`, {
    method: "POST",
  })
}

export async function deleteReplay(replayId: string): Promise<void> {
  await apiFetch(`/api/replays/${encodeURIComponent(replayId)}`, {
    method: "DELETE",
  })
}

type ReplayPlaybackResponse = {
  data?: {
    playback?: {
      grant?: {
        url?: string
        expiresAt?: string
      }
    }
  }
}

export async function fetchReplayPlaybackUrl(
  replayId: string,
): Promise<string> {
  const response = await apiFetch<ReplayPlaybackResponse>(
    `/api/replays/${encodeURIComponent(replayId)}/playback`,
  )
  const url = response.data?.playback?.grant?.url
  if (!url) {
    throw new Error("Playback URL missing from server response.")
  }
  return url
}

function playbackGrantStillValid(expiresAt?: string) {
  if (!expiresAt) return true
  return new Date(expiresAt).getTime() > Date.now() + 5000
}

/** Prefer list payload URL when fresh; otherwise request a new grant from the web API. */
export async function resolveReplayPlaybackUrl(
  replay: Pick<ReplaySummary, "id" | "videoUrl" | "playbackExpiresAt">,
): Promise<string> {
  if (replay.videoUrl && playbackGrantStillValid(replay.playbackExpiresAt)) {
    return replay.videoUrl
  }
  return fetchReplayPlaybackUrl(replay.id)
}

export async function fetchUserReplays(): Promise<ReplaySummary[]> {
  if (!USE_LIVE_ACTIVITY_CLIPS) {
    return MOCK_REPLAYS.map((replay) => ({
      ...replay,
      status: "ready" as const,
    }))
  }

  const response = await apiFetch<ReplaysMineResponse>("/api/replays/mine")
  const rows = response.data?.replays ?? []

  return rows.map(mapReplay)
}
