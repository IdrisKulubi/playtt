import { getMediaStore } from "@/server/media/factory"
import {
  markMediaAssetDeleted,
  markMediaAssetFailed,
} from "@/server/media/repository"
import {
  EVENT_TYPES,
  EVENT_VERSION,
} from "@/server/workers/events.mjs"

type MediaDeleteOutboxRow = {
  tenantId: string | null
  payload: Record<string, unknown>
}

export async function consumeMediaDelete(row: MediaDeleteOutboxRow) {
  const tenantId = row.tenantId
  const mediaId = String(row.payload.mediaId ?? "")
  const objectKey = String(row.payload.objectKey ?? "")

  if (!tenantId || !mediaId || !objectKey) {
    throw new Error("Media delete event is missing required payload fields.")
  }

  const store = getMediaStore()

  try {
    await store.deleteObject(objectKey)
  } catch (error) {
    await markMediaAssetFailed({
      mediaId,
      tenantId,
      lastError: "delete_failed",
    })
    throw error
  }

  const deleted = await markMediaAssetDeleted({ mediaId, tenantId })

  if (!deleted) {
    throw new Error(`Media asset ${mediaId} was not in deletion_pending state.`)
  }

  return deleted
}

export function createMediaDeleteConsumers() {
  return {
    [EVENT_TYPES.MEDIA_DELETE_V1]: {
      eventVersion: EVENT_VERSION,
      consume: consumeMediaDelete,
    },
  }
}
