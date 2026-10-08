export type ReplayStatus =
  | "queued"
  | "processing"
  | "ready"
  | "failed"
  | "unknown"

export interface ReplaySummary {
  id: string
  title: string
  recordedAt: string
  durationSeconds: number
  locationName: string
  status: ReplayStatus
  videoUrl?: string
  posterUrl?: string
  posterExpiresAt?: string
  bookingId?: string
  mediaId?: string
  playbackExpiresAt?: string
  coachReviewed?: boolean
  isFavorite?: boolean
}
