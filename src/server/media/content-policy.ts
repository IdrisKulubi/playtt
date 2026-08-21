import { MEDIA_CONTENT_TYPES, MEDIA_SIZE_LIMITS } from "@/server/media/constants"
import { MediaServiceError } from "@/server/media/errors"
import type { MediaKind } from "@/server/media/types"

export function resolveMediaContentPolicy(kind: MediaKind) {
  return {
    expectedContentType: MEDIA_CONTENT_TYPES[kind],
    expectedMaxBytes: MEDIA_SIZE_LIMITS[kind],
  }
}

export function assertMediaKind(value: unknown): MediaKind {
  if (
    value === "source_video" ||
    value === "preview_image" ||
    value === "derived_video"
  ) {
    return value
  }

  throw new MediaServiceError(
    "VALIDATION_ERROR",
    "Unsupported media kind.",
    400,
  )
}

export function validateCompletionAgainstPolicy(input: {
  expectedContentType: string
  expectedMaxBytes: number
  contentType: string | null
  sizeBytes: number
}) {
  const contentType = input.contentType?.trim() ?? ""

  if (contentType !== input.expectedContentType) {
    throw new MediaServiceError(
      "MEDIA_CONTENT_TYPE_MISMATCH",
      "Uploaded media content type does not match policy.",
      409,
    )
  }

  if (input.sizeBytes <= 0 || input.sizeBytes > input.expectedMaxBytes) {
    throw new MediaServiceError(
      "MEDIA_SIZE_POLICY_VIOLATION",
      "Uploaded media size does not match policy.",
      409,
    )
  }
}

export function isLegacyReplayUrl(videoUrl: string | null | undefined) {
  if (!videoUrl) {
    return false
  }

  try {
    const parsed = new URL(videoUrl)
    return parsed.hostname === "playtt.local"
  } catch {
    return false
  }
}
