import { apiFetch } from "@/lib/api-client"
import type { ReplaySummary, ReplayStatus } from "@/lib/replay-types"
import { USE_LIVE_REPLAY_LIBRARY } from "@/lib/mock/mock-config"
import { MOCK_REPLAYS } from "@/lib/mock/mock-replays"

type ReplaysMineResponse = {
  data?: {
    replays?: Array<{
      id: string
      title: string
      recordedAt: string
      durationSeconds: number
      locationName: string
      status: string
      videoUrl?: string
      bookingId?: string
      mediaId?: string
      playbackExpiresAt?: string
    }>
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

function mapReplay(row: NonNullable<ReplaysMineResponse["data"]>["replays"][number]): ReplaySummary {
  return {
    id: row.id,
    title: row.title,
    recordedAt: row.recordedAt,
    durationSeconds: row.durationSeconds,
    locationName: row.locationName,
    status: normalizeReplayStatus(row.status),
    videoUrl: row.videoUrl,
    bookingId: row.bookingId,
    mediaId: row.mediaId,
    playbackExpiresAt: row.playbackExpiresAt,
  }
}

export async function fetchUserReplays(): Promise<ReplaySummary[]> {
  if (!USE_LIVE_REPLAY_LIBRARY) {
    return MOCK_REPLAYS.map((replay) => ({
      ...replay,
      status: "ready" as const,
    }))
  }

  const response = await apiFetch<ReplaysMineResponse>("/api/replays/mine")
  const rows = response.data?.replays ?? []

  return rows.map(mapReplay)
}
