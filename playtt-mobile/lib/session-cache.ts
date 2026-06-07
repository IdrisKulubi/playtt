import * as SecureStore from "expo-secure-store"

const SESSION_ROUTE_CACHE_KEY = "playtt_session_route_cache_v1"

export type CachedSessionRoute = {
  userId?: string | null
  route: string
  updatedAt: string
}

export async function getCachedSessionRoute() {
  const value = await SecureStore.getItemAsync(SESSION_ROUTE_CACHE_KEY)

  if (!value) {
    return null
  }

  try {
    return JSON.parse(value) as CachedSessionRoute
  } catch {
    return null
  }
}

export async function setCachedSessionRoute(input: {
  userId?: string | null
  route: string
}) {
  await SecureStore.setItemAsync(
    SESSION_ROUTE_CACHE_KEY,
    JSON.stringify({
      ...input,
      updatedAt: new Date().toISOString(),
    })
  )
}

export async function clearCachedSessionRoute() {
  await SecureStore.deleteItemAsync(SESSION_ROUTE_CACHE_KEY)
}
