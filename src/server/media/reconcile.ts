import { PLAYTT_TENANT_ID } from "@/server/tenancy/constants"
import { getMediaStore } from "@/server/media/factory"
import { buildMediaPrefix } from "@/server/media/object-keys"
import {
  listDeletionPendingMediaAssets,
  listReadyMediaAssetsForTenant,
  listStalePendingMediaAssets,
  markMediaAssetFailed,
} from "@/server/media/repository"

export async function reconcileMediaStorage(now = new Date()) {
  const store = getMediaStore()
  const stalePending = await listStalePendingMediaAssets(now)
  let markedFailed = 0

  for (const asset of stalePending) {
    await markMediaAssetFailed({
      mediaId: asset.id,
      tenantId: asset.tenantId,
      lastError: "stale_pending_upload",
    })
    markedFailed += 1
  }

  const readyAssets = await listReadyMediaAssetsForTenant(PLAYTT_TENANT_ID)
  let missingObjects = 0

  for (const asset of readyAssets) {
    try {
      const head = await store.headObject(asset.objectKey)

      if (!head) {
        await markMediaAssetFailed({
          mediaId: asset.id,
          tenantId: asset.tenantId,
          lastError: "ready_object_missing",
        })
        missingObjects += 1
      }
    } catch {
      // Storage outage must not corrupt booking/payment truth; skip hard failure.
    }
  }

  const deletionPending = await listDeletionPendingMediaAssets()
  const prefix = buildMediaPrefix({ tenantId: PLAYTT_TENANT_ID })
  let unexpectedObjects = 0

  try {
    const listed = await store.listPrefix(prefix)
    const knownKeys = new Set([
      ...readyAssets.map((asset) => asset.objectKey),
      ...deletionPending.map((asset) => asset.objectKey),
      ...stalePending.map((asset) => asset.objectKey),
    ])

    unexpectedObjects = listed.filter((item) => !knownKeys.has(item.objectKey))
      .length
  } catch {
    // Ignore reconciliation list failures during provider outage.
  }

  return {
    markedFailed,
    missingObjects,
    deletionPending: deletionPending.length,
    unexpectedObjects,
  }
}
