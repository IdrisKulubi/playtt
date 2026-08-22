import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"

import type { UploadGrant } from "../cloud/client"
import { safeLog } from "../health/metrics"

export interface DirectUploadResult {
  etag: string | null
  checksumSha256: string
  bytesUploaded: number
}

export async function uploadToPresignedUrl(input: {
  grant: UploadGrant
  filePath: string
  fetchImpl?: typeof fetch
}): Promise<DirectUploadResult> {
  const fetchImpl = input.fetchImpl ?? fetch
  const body = await readFile(input.filePath)
  const checksumSha256 = createHash("sha256").update(body).digest("hex")

  const contentType = input.grant.contentType?.trim() || "video/mp4"
  const response = await fetchImpl(input.grant.url, {
    method: "PUT",
    headers: {
      "content-type": contentType,
    },
    body,
  })

  if (!response.ok) {
    const text = await response.text()
    safeLog("error", "Direct upload failed", {
      status: response.status,
      bodyPreview: text.slice(0, 120),
    })
    throw new Error("upload_failed")
  }

  return {
    etag: response.headers.get("etag"),
    checksumSha256,
    bytesUploaded: body.byteLength,
  }
}
