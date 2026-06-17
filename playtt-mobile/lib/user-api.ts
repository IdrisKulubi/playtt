import { router } from "expo-router"

import { apiFetch } from "@/lib/api-client"
import { authDebug, authDebugError } from "@/lib/auth-debug"
import { AUTHENTICATED_HOME } from "@/lib/auth-navigation"
import { getCachedSessionRoute, setCachedSessionRoute } from "@/lib/session-cache"
import { isTransientApiError } from "@/lib/api-errors"

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

  try {
    const response = await fetchCurrentUser()
    const route = response.data?.route ?? AUTHENTICATED_HOME

    await setCachedSessionRoute({
      userId: response.data?.user?.id,
      route,
    })

    authDebug("resolve-post-auth-route:done", { route })
    return route
  } catch (error) {
    if (isTransientApiError(error)) {
      const cached = await getCachedSessionRoute()
      const route = cached?.route ?? AUTHENTICATED_HOME
      authDebug("resolve-post-auth-route:offline-fallback", { route })
      return route
    }

    throw error
  }
}

export async function routeAfterAuth() {
  authDebug("route-after-auth:start")

  try {
    const response = await fetchCurrentUser()
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
