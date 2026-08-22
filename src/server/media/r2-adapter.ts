import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"

import type {
  DownloadGrant,
  ExactGetGrantInput,
  ExactPutGrantInput,
  ListedObject,
  MediaStore,
  ObjectHead,
  UploadGrant,
} from "@/server/media/types"

function requireR2Env(name: string, value: string | undefined) {
  const trimmed = value?.trim()

  if (!trimmed) {
    throw new Error(`Missing required R2 environment variable: ${name}`)
  }

  return trimmed
}

function createR2Client() {
  const accountId = requireR2Env("R2_ACCOUNT_ID", process.env.R2_ACCOUNT_ID)
  const accessKeyId = requireR2Env(
    "R2_ACCESS_KEY_ID",
    process.env.R2_ACCESS_KEY_ID,
  )
  const secretAccessKey = requireR2Env(
    "R2_SECRET_ACCESS_KEY",
    process.env.R2_SECRET_ACCESS_KEY,
  )
  const endpoint =
    process.env.R2_ENDPOINT?.trim() ??
    `https://${accountId}.r2.cloudflarestorage.com`

  return new S3Client({
    region: process.env.R2_REGION?.trim() || "auto",
    endpoint,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
    // Presigned PUTs must not sign flexible checksum headers; R2 returns
    // SignatureDoesNotMatch if the uploader sends extra x-amz-checksum-*.
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  })
}

export class R2MediaStore implements MediaStore {
  private readonly client: S3Client
  private readonly bucket: string

  constructor() {
    this.client = createR2Client()
    this.bucket = requireR2Env("R2_BUCKET", process.env.R2_BUCKET)
  }

  async createUploadGrant(input: ExactPutGrantInput): Promise<UploadGrant> {
    const expiresAt = new Date(Date.now() + input.expiresInSeconds * 1000)
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: input.objectKey,
      ContentType: input.contentType,
    })
    const url = await getSignedUrl(this.client, command, {
      expiresIn: input.expiresInSeconds,
    })

    return {
      url,
      method: "PUT",
      objectKey: input.objectKey,
      contentType: input.contentType,
      expiresAt: expiresAt.toISOString(),
    }
  }

  async createDownloadGrant(input: ExactGetGrantInput): Promise<DownloadGrant> {
    const expiresAt = new Date(Date.now() + input.expiresInSeconds * 1000)
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: input.objectKey,
    })
    const url = await getSignedUrl(this.client, command, {
      expiresIn: input.expiresInSeconds,
    })

    return {
      url,
      method: "GET",
      objectKey: input.objectKey,
      expiresAt: expiresAt.toISOString(),
    }
  }

  async headObject(objectKey: string): Promise<ObjectHead | null> {
    try {
      const response = await this.client.send(
        new HeadObjectCommand({
          Bucket: this.bucket,
          Key: objectKey,
        }),
      )

      return {
        objectKey,
        contentType: response.ContentType ?? null,
        sizeBytes: Number(response.ContentLength ?? 0),
        etag: response.ETag ?? null,
      }
    } catch (error) {
      if (isNotFoundError(error)) {
        return null
      }

      throw error
    }
  }

  async deleteObject(objectKey: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: objectKey,
      }),
    )
  }

  async listPrefix(prefix: string): Promise<ListedObject[]> {
    const objects: ListedObject[] = []
    let continuationToken: string | undefined

    do {
      const response = await this.client.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: prefix,
          ContinuationToken: continuationToken,
        }),
      )

      for (const item of response.Contents ?? []) {
        if (!item.Key) {
          continue
        }

        objects.push({
          objectKey: item.Key,
          sizeBytes: Number(item.Size ?? 0),
          lastModified: item.LastModified?.toISOString() ?? null,
        })
      }

      continuationToken = response.IsTruncated
        ? response.NextContinuationToken
        : undefined
    } while (continuationToken)

    return objects
  }
}

function isNotFoundError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false
  }

  const candidate = error as { name?: string; $metadata?: { httpStatusCode?: number } }
  return (
    candidate.name === "NotFound" ||
    candidate.name === "NoSuchKey" ||
    candidate.$metadata?.httpStatusCode === 404
  )
}

export function createR2MediaStore(): MediaStore {
  return new R2MediaStore()
}
