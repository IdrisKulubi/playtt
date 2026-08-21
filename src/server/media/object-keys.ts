import type { MediaKind } from "@/server/media/types"

const KIND_FILE_NAMES: Record<MediaKind, string> = {
  source_video: "source.mp4",
  preview_image: "preview.jpg",
  derived_video: "derived-720p.mp4",
}

export function buildMediaObjectKey(input: {
  tenantId: string
  locationId: string
  resourceId: string
  playSessionId: string
  mediaId: string
  kind: MediaKind
}) {
  const fileName = KIND_FILE_NAMES[input.kind]

  return [
    "tenant",
    input.tenantId,
    "venue",
    input.locationId,
    "resource",
    input.resourceId,
    "session",
    input.playSessionId,
    "replay",
    input.mediaId,
    fileName,
  ].join("/")
}

export function buildMediaPrefix(input: {
  tenantId: string
  locationId?: string
}) {
  if (input.locationId) {
    return `tenant/${input.tenantId}/venue/${input.locationId}/`
  }

  return `tenant/${input.tenantId}/`
}
