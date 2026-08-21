import { createFakeMediaStore } from "@/server/media/fake-adapter"
import { createR2MediaStore } from "@/server/media/r2-adapter"
import {
  assertFakeMediaStoreAllowed,
  shouldAllowFakeMediaStore,
} from "@/server/media/stub-policy"
import type { MediaStore } from "@/server/media/types"

const globalForMediaStore = globalThis as typeof globalThis & {
  __playttMediaStore?: MediaStore
}

function resolveMediaStoreDriver() {
  const configured = process.env.MEDIA_STORE_DRIVER?.trim().toLowerCase()

  if (configured === "r2") {
    return "r2"
  }

  if (configured === "fake") {
    return "fake"
  }

  const hasR2Config =
    Boolean(process.env.R2_BUCKET?.trim()) &&
    Boolean(process.env.R2_ACCESS_KEY_ID?.trim()) &&
    Boolean(process.env.R2_SECRET_ACCESS_KEY?.trim())

  if (hasR2Config) {
    return "r2"
  }

  return "fake"
}

function createMediaStoreInstance(): MediaStore {
  const driver = resolveMediaStoreDriver()

  if (driver === "r2") {
    return createR2MediaStore()
  }

  if (!shouldAllowFakeMediaStore({
    environment: process.env.NODE_ENV,
    driver,
  })) {
    assertFakeMediaStoreAllowed(process.env.NODE_ENV)
  }

  return createFakeMediaStore()
}

export function getMediaStore(): MediaStore {
  if (!globalForMediaStore.__playttMediaStore) {
    globalForMediaStore.__playttMediaStore = createMediaStoreInstance()
  }

  return globalForMediaStore.__playttMediaStore
}

export function resetMediaStoreForTests() {
  delete globalForMediaStore.__playttMediaStore
}

export function getResolvedMediaStoreDriverForTests() {
  return resolveMediaStoreDriver()
}
