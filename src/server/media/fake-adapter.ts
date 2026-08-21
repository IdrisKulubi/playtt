import type {
  DownloadGrant,
  ExactGetGrantInput,
  ExactPutGrantInput,
  ListedObject,
  MediaStore,
  ObjectHead,
  UploadGrant,
} from "@/server/media/types"

interface StoredObject {
  contentType: string
  sizeBytes: number
  etag: string
  lastModified: string
}

export class FakeMediaStore implements MediaStore {
  private readonly objects = new Map<string, StoredObject>()
  private outage = false

  setOutage(enabled: boolean) {
    this.outage = enabled
  }

  putObjectForTest(input: {
    objectKey: string
    contentType: string
    sizeBytes: number
    etag?: string
  }) {
    this.objects.set(input.objectKey, {
      contentType: input.contentType,
      sizeBytes: input.sizeBytes,
      etag: input.etag ?? `"fake-${input.sizeBytes}"`,
      lastModified: new Date().toISOString(),
    })
  }

  private assertAvailable() {
    if (this.outage) {
      throw new Error("Fake MediaStore outage.")
    }
  }

  async createUploadGrant(input: ExactPutGrantInput): Promise<UploadGrant> {
    this.assertAvailable()
    const expiresAt = new Date(Date.now() + input.expiresInSeconds * 1000)

    return {
      url: `https://fake-media.local/upload/${encodeURIComponent(input.objectKey)}?expires=${expiresAt.getTime()}`,
      method: "PUT",
      objectKey: input.objectKey,
      contentType: input.contentType,
      expiresAt: expiresAt.toISOString(),
    }
  }

  async createDownloadGrant(input: ExactGetGrantInput): Promise<DownloadGrant> {
    this.assertAvailable()
    const expiresAt = new Date(Date.now() + input.expiresInSeconds * 1000)

    return {
      url: `https://fake-media.local/download/${encodeURIComponent(input.objectKey)}?expires=${expiresAt.getTime()}`,
      method: "GET",
      objectKey: input.objectKey,
      expiresAt: expiresAt.toISOString(),
    }
  }

  async headObject(objectKey: string): Promise<ObjectHead | null> {
    this.assertAvailable()
    const object = this.objects.get(objectKey)

    if (!object) {
      return null
    }

    return {
      objectKey,
      contentType: object.contentType,
      sizeBytes: object.sizeBytes,
      etag: object.etag,
    }
  }

  async deleteObject(objectKey: string): Promise<void> {
    this.assertAvailable()
    this.objects.delete(objectKey)
  }

  async listPrefix(prefix: string): Promise<ListedObject[]> {
    this.assertAvailable()

    return [...this.objects.entries()]
      .filter(([key]) => key.startsWith(prefix))
      .map(([objectKey, object]) => ({
        objectKey,
        sizeBytes: object.sizeBytes,
        lastModified: object.lastModified,
      }))
  }
}

const globalForFakeMedia = globalThis as typeof globalThis & {
  __playttFakeMediaStore?: FakeMediaStore
}

export function getFakeMediaStore(): FakeMediaStore {
  if (!globalForFakeMedia.__playttFakeMediaStore) {
    globalForFakeMedia.__playttFakeMediaStore = new FakeMediaStore()
  }

  return globalForFakeMedia.__playttFakeMediaStore
}

export function resetFakeMediaStoreForTests() {
  delete globalForFakeMedia.__playttFakeMediaStore
}

export function createFakeMediaStore(): MediaStore {
  return getFakeMediaStore()
}
