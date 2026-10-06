import { router } from "expo-router"

import { apiFetch } from "@/lib/api-client"
import { authDebug, authDebugError } from "@/lib/auth-debug"
import { AUTHENTICATED_HOME } from "@/lib/auth-navigation"
import { getCachedSessionRoute, setCachedSessionRoute } from "@/lib/session-cache"
import { isTransientApiError } from "@/lib/api-errors"
import { ApiError } from "@/lib/api-error"
import { getStoredAuth } from "@/lib/auth-helpers"
import { getSessionRevision } from "@/lib/auth-session-state"

async function assertCurrentSession(revision: number) {
  if (revision !== getSessionRevision() || !(await getStoredAuth())?.token) {
    throw new ApiError({ status: 401, code: "UNAUTHENTICATED", message: "Please sign in again." })
  }
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
  return apiFetch<CurrentUserResponse>("/api/user/me")
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
  return apiFetch<OnboardingPatchResponse>("/api/user/onboarding", {
    method: "PATCH",
    body: JSON.stringify(body),
  })
}

export async function patchProfile(body: ProfilePatchInput) {
  return apiFetch<OnboardingPatchResponse>("/api/user/profile", {
    method: "PATCH",
    body: JSON.stringify(body),
  })
}
