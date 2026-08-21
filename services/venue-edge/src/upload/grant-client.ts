import type { EdgeV1Client, UploadGrant } from "../cloud/client"
import { safeLog } from "../health/metrics"

export async function renewUploadGrant(
  client: EdgeV1Client,
  mediaAssetId: string,
  currentGrant?: UploadGrant | null,
): Promise<UploadGrant> {
  if (currentGrant && !isGrantExpired(currentGrant)) {
    return currentGrant
  }

  const grant = await client.renewUploadGrant(mediaAssetId)
  safeLog("info", "Upload grant renewed", {
    mediaAssetId,
    expiresAt: grant.expiresAt,
  })

  return grant
}

export function isGrantExpired(grant: UploadGrant, skewMs = 30_000): boolean {
  const expiresAt = Date.parse(grant.expiresAt)
  return Number.isNaN(expiresAt) || expiresAt - skewMs <= Date.now()
}
