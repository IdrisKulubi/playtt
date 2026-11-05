import * as SecureStore from "expo-secure-store"

import type { UserProfile } from "@/lib/user-api"

const PROFILE_CACHE_KEY = "playtt_profile_cache_v1"

type CachedProfile = {
  user: UserProfile
  cachedAt: string
}

/**
 * A small encrypted snapshot for the account screen. It is deliberately
 * separate from authentication: a cached profile never grants API access.
 */
export async function getCachedUserProfile(): Promise<UserProfile | null> {
  const value = await SecureStore.getItemAsync(PROFILE_CACHE_KEY)
  if (!value) return null

  try {
    const cached = JSON.parse(value) as CachedProfile
    return isUserProfile(cached.user) ? cached.user : null
  } catch {
    return null
  }
}

export async function setCachedUserProfile(user: UserProfile) {
  await SecureStore.setItemAsync(
    PROFILE_CACHE_KEY,
    JSON.stringify({ user, cachedAt: new Date().toISOString() } satisfies CachedProfile),
  )
}

export async function clearCachedUserProfile() {
  await SecureStore.deleteItemAsync(PROFILE_CACHE_KEY)
}

export async function updateCachedUserProfile(patch: Partial<UserProfile>) {
  const current = await getCachedUserProfile()
  if (current) {
    await setCachedUserProfile({ ...current, ...patch })
  }
}

function isUserProfile(value: unknown): value is UserProfile {
  return Boolean(
    value &&
      typeof value === "object" &&
      typeof (value as UserProfile).id === "string" &&
      typeof (value as UserProfile).name === "string" &&
      typeof (value as UserProfile).email === "string",
  )
}
