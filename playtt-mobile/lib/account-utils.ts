import {
  PLAY_INTENT_OPTIONS,
  SKILL_LEVEL_OPTIONS,
} from "@/lib/onboarding-options"
import type { UserProfile } from "@/lib/user-api"

export function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)

  if (parts.length === 0) {
    return "?"
  }

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase()
  }

  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}

export function formatSkillLevel(skillLevel?: string | null) {
  return (
    SKILL_LEVEL_OPTIONS.find((option) => option.value === skillLevel)?.label ??
    "Not set"
  )
}

export function formatPlayIntent(playIntent?: string | null) {
  return (
    PLAY_INTENT_OPTIONS.find((option) => option.value === playIntent)?.label ??
    null
  )
}

export function formatPhonePreview(phone?: string | null) {
  if (!phone?.trim()) {
    return "No phone added"
  }

  return phone
}

export function formatPersonalDetailsPreview(profile: UserProfile) {
  const phone = formatPhonePreview(profile.phone)
  const skill = formatSkillLevel(profile.skillLevel)

  return `${phone} · ${skill}`
}

export function getOAuthProviderLabel(providers: UserProfile["authMethods"]) {
  if (!providers?.providers.length) {
    return null
  }

  if (providers.providers.includes("apple")) {
    return "Signed in with Apple"
  }

  if (providers.providers.includes("google")) {
    return "Signed in with Google"
  }

  return null
}

export function canChangePassword(authMethods?: UserProfile["authMethods"]) {
  return Boolean(authMethods?.hasPassword)
}
