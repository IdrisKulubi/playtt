import { router } from "expo-router"

import { apiFetch } from "@/lib/api-client"
import { authDebug, authDebugError } from "@/lib/auth-debug"
import { AUTHENTICATED_HOME } from "@/lib/auth-navigation"
import { getCachedSessionRoute, setCachedSessionRoute } from "@/lib/session-cache"
import { isTransientApiError } from "@/lib/api-errors"
import { ApiError } from "@/lib/api-error"
import { getStoredAuth } from "@/lib/auth-helpers"
import { getSessionRevision } from "@/lib/auth-session-state"
import { setCachedUserProfile, updateCachedUserProfile } from "@/lib/profile-cache"

async function assertCurrentSession(revision: number) {
  if (revision !== getSessionRevision() || !(await getStoredAuth())?.token) {
    throw new ApiError({ status: 401, code: "UNAUTHENTICATED", message: "Please sign in again." })
  }
}

/** Permanently delete this account (App Store 5.1.1(v)). The server signs the player out everywhere. */
export async function deleteAccount() {
  await apiFetch<null>("/api/user/me", { method: "DELETE" })
}

export type UserAuthMethods = {
  providers: ("credential" | "google" | "apple")[]
  hasPassword: boolean
}

export type UserProfile = {
  id: string
  name: string
  email: string
  emailVerified: boolean
  image?: string | null
  phone?: string | null
  skillLevel?: string | null
  referralSource?: string | null
  playIntent?: string | null
  earlyAdopterOptIn?: boolean
  onboardingCompletedAt?: string | null
  authMethods?: UserAuthMethods
}

export type ProfilePatchInput = {
  name: string
  skillLevel: string
  phone: string
}

export type CurrentUserResponse = {
  data?: {
    user?: UserProfile
    route?: string
  }
}

export type OnboardingPatchResponse = {
  data?: {
    user?: UserProfile
  }
}

export async function fetchCurrentUser() {
  const response = await apiFetch<CurrentUserResponse>("/api/user/me")
  const user = response.data?.user

  // Cache only a server-verified response. The cache is display-only and lets
  // the account page render useful information while the next request waits.
  if (user) {
    await setCachedUserProfile(user).catch(() => undefined)
  }

  return response
}

export async function resolvePostAuthRoute() {
  authDebug("resolve-post-auth-route:start")
  const revision = getSessionRevision()

  try {
    const response = await fetchCurrentUser()
    await assertCurrentSession(revision)
    const route = response.data?.route ?? AUTHENTICATED_HOME

    await setCachedSessionRoute({
      userId: response.data?.user?.id,
      route,
    })

    await assertCurrentSession(revision)

    authDebug("resolve-post-auth-route:done", { route })
    return route
  } catch (error) {
    if (isTransientApiError(error)) {
      await assertCurrentSession(revision)
      const cached = await getCachedSessionRoute()
      await assertCurrentSession(revision)
      const route = cached?.route ?? AUTHENTICATED_HOME
      authDebug("resolve-post-auth-route:offline-fallback", { route })
      return route
    }

    throw error
  }
}

export async function routeAfterAuth() {
  authDebug("route-after-auth:start")
  const revision = getSessionRevision()

  try {
    const response = await fetchCurrentUser()
    await assertCurrentSession(revision)
    const route = response.data?.route ?? AUTHENTICATED_HOME

    authDebug("route-after-auth:resolved", {
      route,
      userId: response.data?.user?.id,
      onboardingCompletedAt: response.data?.user?.onboardingCompletedAt,
    })

    await setCachedSessionRoute({
      userId: response.data?.user?.id,
      route,
    })

    await assertCurrentSession(revision)

    authDebug("route-after-auth:navigate", { route })
    router.replace(route as never)
    authDebug("route-after-auth:done")
  } catch (error) {
    authDebugError("route-after-auth:failed", error)
    throw error
  }
}

export async function patchOnboarding(body: Record<string, unknown>) {
  const response = await apiFetch<OnboardingPatchResponse>("/api/user/onboarding", {
    method: "PATCH",
    body: JSON.stringify(body),
  })
  if (response.data?.user) {
    await setCachedUserProfile(response.data.user).catch(() => undefined)
  }
  return response
}

export async function patchProfile(body: ProfilePatchInput) {
  const response = await apiFetch<OnboardingPatchResponse>("/api/user/profile", {
    method: "PATCH",
    body: JSON.stringify(body),
  })
  if (response.data?.user) {
    await setCachedUserProfile(response.data.user).catch(() => undefined)
  }
  return response
}

export type AvatarContentType = "image/jpeg" | "image/png" | "image/webp"

type AvatarUploadGrantResponse = {
  data: {
    upload: { url: string; method: "PUT"; objectKey: string; contentType: string; expiresAt: string }
    maxBytes: number
  }
}

/**
 * Profile photo → R2: ask for a presigned PUT, upload the local file straight
 * to R2, then confirm so the server points user.image at it.
 */
export async function uploadAvatar(localUri: string, contentType: AvatarContentType) {
  const { data } = await apiFetch<AvatarUploadGrantResponse>("/api/user/avatar", {
    method: "POST",
    body: JSON.stringify({ contentType }),
  })

  const file = await (await fetch(localUri)).blob()
  if (file.size > data.maxBytes) {
    throw new ApiError({ status: 400, code: "VALIDATION_ERROR", message: "Photos must be under 5 MB." })
  }

  const upload = await fetch(data.upload.url, {
    method: "PUT",
    headers: { "content-type": data.upload.contentType },
    body: file,
  })
  if (!upload.ok) {
    throw new ApiError({ status: upload.status, code: "AVATAR_UPLOAD_FAILED", message: "Could not upload your photo. Try again." })
  }

  const confirmed = await apiFetch<{ data: { image: string } }>("/api/user/avatar", {
    method: "PUT",
    body: JSON.stringify({ objectKey: data.upload.objectKey }),
  })
  await updateCachedUserProfile({ image: confirmed.data.image }).catch(() => undefined)
  return confirmed.data.image
}

export async function removeAvatar() {
  await apiFetch<{ data: { image: null } }>("/api/user/avatar", { method: "DELETE" })
  await updateCachedUserProfile({ image: null }).catch(() => undefined)
}
