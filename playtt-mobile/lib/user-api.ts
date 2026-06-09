import { router } from "expo-router"

import { apiFetch } from "@/lib/api-client"
import { AUTHENTICATED_HOME } from "@/lib/auth-navigation"
import { setCachedSessionRoute } from "@/lib/session-cache"

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
  const response = await fetchCurrentUser()
  return response.data?.route ?? AUTHENTICATED_HOME
}

export async function routeAfterAuth() {
  const response = await fetchCurrentUser()
  const route = response.data?.route ?? AUTHENTICATED_HOME

  await setCachedSessionRoute({
    userId: response.data?.user?.id,
    route,
  })

  router.replace(route as never)
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
