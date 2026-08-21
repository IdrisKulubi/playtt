export const MEDIA_UPLOAD_GRANT_TTL_SECONDS = 300
export const MEDIA_DOWNLOAD_GRANT_TTL_SECONDS = 300

export const MEDIA_SIZE_LIMITS = {
  source_video: 200 * 1024 * 1024,
  derived_video: 100 * 1024 * 1024,
  preview_image: 2 * 1024 * 1024,
} as const

export const MEDIA_CONTENT_TYPES = {
  source_video: "video/mp4",
  derived_video: "video/mp4",
  preview_image: "image/jpeg",
} as const

export const MEDIA_EVENT_TYPES = {
  UPLOAD_COMPLETE: "upload_complete",
  DELETE_COMPLETE: "delete_complete",
} as const

export const MEDIA_OUTBOX_EVENT_TYPES = {
  DELETE_V1: "media.delete.v1",
} as const

export const MEDIA_STALE_PENDING_HOURS = 24
