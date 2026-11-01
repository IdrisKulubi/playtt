// Profile photo upload to R2: grant → client PUT → confirm (docs/community/player-card.md).

import { randomUUID } from "node:crypto"

import { eq } from "drizzle-orm"
import { z } from "zod"

import db from "../../../db/drizzle"
import { user } from "../../../db/schema"
import { getMediaStore } from "@/server/media/factory"

import {
  AVATAR_CONTENT_TYPES,
  AVATAR_RULES,
  avatarImagePath,
  avatarKeyFromImage,
  avatarObjectKey,
  isAvatarContentType,
  newAvatarFileName,
  ownsAvatarKey,
} from "./avatar-rules"

const contentTypes = Object.keys(AVATAR_CONTENT_TYPES) as [string, ...string[]]

export const avatarUploadRequestSchema = z.object({
  contentType: z.enum(contentTypes, { message: "Use a JPEG, PNG or WebP photo." }),
})

export const avatarConfirmSchema = z.object({
  objectKey: z.string().trim().min(1, "objectKey is required"),
})

type AvatarResult<T> = { ok: true; value: T } | { ok: false; code: string; message: string; status: number }

export async function createAvatarUpload(userId: string, contentType: string) {
  if (!isAvatarContentType(contentType)) {
    return { ok: false, code: "VALIDATION_ERROR", message: "Use a JPEG, PNG or WebP photo.", status: 400 } as const
  }

  const objectKey = avatarObjectKey(userId, newAvatarFileName(contentType, randomUUID()))
  const grant = await getMediaStore().createUploadGrant({
    objectKey,
    contentType,
    maxBytes: AVATAR_RULES.maxBytes,
    expiresInSeconds: AVATAR_RULES.uploadGrantSeconds,
  })

  return { ok: true, value: { upload: grant, maxBytes: AVATAR_RULES.maxBytes } } as const
}

/** Verifies the uploaded object, points `user.image` at it and removes the previous photo. */
export async function confirmAvatarUpload(
  userId: string,
  objectKey: string,
): Promise<AvatarResult<{ image: string }>> {
  if (!ownsAvatarKey(userId, objectKey)) {
    return { ok: false, code: "VALIDATION_ERROR", message: "That upload does not belong to you.", status: 400 }
  }

  const store = getMediaStore()
  const head = await store.headObject(objectKey)
  if (!head) {
    return { ok: false, code: "AVATAR_NOT_UPLOADED", message: "The photo upload did not finish. Try again.", status: 409 }
  }
  if (head.sizeBytes > AVATAR_RULES.maxBytes || !head.contentType || !isAvatarContentType(head.contentType)) {
    await store.deleteObject(objectKey).catch(() => undefined)
    return { ok: false, code: "VALIDATION_ERROR", message: "Photos must be JPEG, PNG or WebP and under 5 MB.", status: 400 }
  }

  const fileName = objectKey.slice(`avatars/${userId}/`.length)
  const image = avatarImagePath(userId, fileName)
  const previous = await replaceUserImage(userId, image)

  const previousKey = avatarKeyFromImage(previous)
  if (previousKey && previousKey !== objectKey) {
    await store.deleteObject(previousKey).catch(() => undefined)
  }

  return { ok: true, value: { image } }
}

export async function removeAvatar(userId: string) {
  const previous = await replaceUserImage(userId, null)
  const previousKey = avatarKeyFromImage(previous)
  if (previousKey) {
    await getMediaStore().deleteObject(previousKey).catch(() => undefined)
  }
}

async function replaceUserImage(userId: string, image: string | null) {
  const [current] = await db.select({ image: user.image }).from(user).where(eq(user.id, userId)).limit(1)
  await db.update(user).set({ image, updatedAt: new Date() }).where(eq(user.id, userId))
  return current?.image ?? null
}

export async function avatarDownloadUrl(objectKey: string) {
  const grant = await getMediaStore().createDownloadGrant({
    objectKey,
    expiresInSeconds: AVATAR_RULES.downloadGrantSeconds,
  })
  return grant.url
}
