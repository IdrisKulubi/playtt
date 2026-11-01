// Pure rules for profile photos stored in R2 (docs/community/player-card.md).
// The photo URL saved on `user.image` is a stable app path; the route behind
// it redirects to a short-lived signed R2 URL, so the bucket stays private.

export const AVATAR_RULES = {
  maxBytes: 5 * 1024 * 1024,
  uploadGrantSeconds: 10 * 60,
  downloadGrantSeconds: 60 * 60,
  /** Browsers and expo-image may cache the redirect a little less than the grant lives. */
  redirectCacheSeconds: 50 * 60,
} as const

export const AVATAR_CONTENT_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const

export type AvatarContentType = keyof typeof AVATAR_CONTENT_TYPES

export function isAvatarContentType(value: string): value is AvatarContentType {
  return Object.hasOwn(AVATAR_CONTENT_TYPES, value)
}

const USER_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/
const FILE_PATTERN = /^[0-9a-f-]{36}\.(jpg|png|webp)$/

export function avatarObjectKey(userId: string, fileName: string) {
  return `avatars/${userId}/${fileName}`
}

export function newAvatarFileName(contentType: AvatarContentType, uuid: string) {
  return `${uuid}.${AVATAR_CONTENT_TYPES[contentType]}`
}

/** App path stored on `user.image`; served by GET /api/avatars/[userId]/[file]. */
export function avatarImagePath(userId: string, fileName: string) {
  return `/api/avatars/${encodeURIComponent(userId)}/${fileName}`
}

/** Validates route params before they become an R2 key. */
export function parseAvatarParams(userId: string, fileName: string) {
  if (!USER_ID_PATTERN.test(userId) || !FILE_PATTERN.test(fileName)) return null
  return { userId, fileName, objectKey: avatarObjectKey(userId, fileName) }
}

/** An uploaded key is only accepted from its owner, in the expected shape. */
export function ownsAvatarKey(userId: string, objectKey: string) {
  const prefix = `avatars/${userId}/`
  if (!objectKey.startsWith(prefix)) return false
  return parseAvatarParams(userId, objectKey.slice(prefix.length)) !== null
}

/** The R2 key behind a stored `user.image`, if it is one of our avatar paths. */
export function avatarKeyFromImage(image: string | null | undefined) {
  if (!image) return null
  const match = /^\/api\/avatars\/([^/]+)\/([^/?#]+)$/.exec(image)
  if (!match) return null
  return parseAvatarParams(decodeURIComponent(match[1]), match[2])?.objectKey ?? null
}
