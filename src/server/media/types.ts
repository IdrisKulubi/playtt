export type MediaKind = "source_video" | "preview_image" | "derived_video"

export type MediaStatus =
  | "pending_upload"
  | "uploaded"
  | "ready"
  | "failed"
  | "deletion_pending"
  | "deleted"

export interface ExactPutGrantInput {
  objectKey: string
  contentType: string
  maxBytes: number
  expiresInSeconds: number
}

export interface ExactGetGrantInput {
  objectKey: string
  expiresInSeconds: number
}

export interface UploadGrant {
  url: string
  method: "PUT"
  objectKey: string
  contentType: string
  expiresAt: string
}

export interface DownloadGrant {
  url: string
  method: "GET"
  objectKey: string
  expiresAt: string
}

export interface ObjectHead {
  objectKey: string
  contentType: string | null
  sizeBytes: number
  etag: string | null
}

export interface ListedObject {
  objectKey: string
  sizeBytes: number
  lastModified: string | null
}

export interface MediaStore {
  createUploadGrant(input: ExactPutGrantInput): Promise<UploadGrant>
  createDownloadGrant(input: ExactGetGrantInput): Promise<DownloadGrant>
  headObject(objectKey: string): Promise<ObjectHead | null>
  deleteObject(objectKey: string): Promise<void>
  listPrefix(prefix: string): Promise<ListedObject[]>
}

export interface MediaAssetRecord {
  id: string
  tenantId: string
  locationId: string
  resourceId: string
  playSessionId: string
  ownerUserId: string
  objectKey: string
  kind: MediaKind
  contentType: string | null
  sizeBytes: number | null
  checksumSha256: string | null
  expectedContentType: string
  expectedMaxBytes: number
  status: MediaStatus
  retentionClass: string
  uploadedAt: string | null
  readyAt: string | null
  deletionRequestedAt: string | null
  deletedAt: string | null
  createdAt: string
  updatedAt: string
}
