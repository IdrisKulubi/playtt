import * as SecureStore from "expo-secure-store"

import type { AppleAuthUser } from "@/lib/auth-api"
import { authDebug, authDebugError } from "@/lib/auth-debug"
import { authClient } from "@/lib/auth-client"
import {
  clearCachedSessionRoute,
  getCachedSessionRoute,
} from "@/lib/session-cache"

const STORAGE_PREFIX = "playtt"

const AUTH_KEYS = {
  cookie: `${STORAGE_PREFIX}_cookie`,
  sessionData: `${STORAGE_PREFIX}_session_data`,
  session: `${STORAGE_PREFIX}_session`,
  sessionToken: `${STORAGE_PREFIX}_session_token`,
  userId: `${STORAGE_PREFIX}_user_id`,
} as const

export type StoredAuth = {
  token: string
  userId?: string | null
  source: "session_data" | "session" | "cookie" | "token"
}

export async function getStoredAuth(): Promise<StoredAuth | null> {
  const sessionData = await readJson(AUTH_KEYS.sessionData)
  const sessionDataToken = extractToken(sessionData)

  if (sessionDataToken) {
    return {
      token: sessionDataToken,
      userId: extractUserId(sessionData),
      source: "session_data",
    }
  }

  const customSession = await readJson(AUTH_KEYS.session)
  const customSessionToken = extractToken(customSession)

  if (customSessionToken) {
    return {
      token: customSessionToken,
      userId: extractUserId(customSession),
      source: "session",
    }
  }

  const cookie = await SecureStore.getItemAsync(AUTH_KEYS.cookie)
  const cookieToken = extractTokenFromCookie(cookie)

  if (cookieToken) {
    return {
      token: cookieToken,
      userId: await getCurrentUserId(),
      source: "cookie",
    }
  }

  const rawToken = normalizeSessionToken(
    await SecureStore.getItemAsync(AUTH_KEYS.sessionToken)
  )

  if (rawToken) {
    return {
      token: rawToken,
      userId: await getCurrentUserId(),
      source: "token",
    }
  }

  return null
}

export async function getAuthToken() {
  const stored = await getStoredAuth()
  return stored?.token ?? null
}

async function clearBetterAuthStorage() {
  await Promise.all([
    SecureStore.deleteItemAsync(AUTH_KEYS.sessionData),
    SecureStore.deleteItemAsync(AUTH_KEYS.cookie),
  ])
}

export async function storeAppleSession(user: AppleAuthUser, token: string) {
  authDebug("store-apple-session:start", {
    userId: user.id,
    tokenLength: token.length,
  })

  await clearBetterAuthStorage()

  const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()

  await SecureStore.setItemAsync(
    AUTH_KEYS.session,
    JSON.stringify({
      session: { token, userId: user.id, expiresAt },
      user,
    }),
  )
  await SecureStore.setItemAsync(AUTH_KEYS.sessionToken, token)
  await SecureStore.setItemAsync(AUTH_KEYS.userId, user.id)

  const stored = await getStoredAuth()
  authDebug("store-apple-session:done", {
    stored: Boolean(stored?.token),
    source: stored?.source,
    userId: stored?.userId,
  })

  if (!stored?.token) {
    authDebugError(
      "store-apple-session:verify-failed",
      new Error("Token not readable immediately after store"),
    )
  }
}

export async function getCurrentUserId() {
  const explicitUserId = await SecureStore.getItemAsync(AUTH_KEYS.userId)
  if (explicitUserId) {
    return explicitUserId
  }

  const sessionData = await readJson(AUTH_KEYS.sessionData)
  return extractUserId(sessionData)
}

export async function getAuthHeaders() {
  const token = await getAuthToken()

  if (!token) {
    return {}
  }

  return {
    Authorization: `Bearer ${token}`,
  }
}

export async function isAuthenticated() {
  return Boolean(await getAuthToken())
}

export async function clearSession() {
  authDebug("clear-session:start")

  try {
    await authClient.signOut()
  } catch (error) {
    authDebugError("clear-session:sign-out-failed", error)
  }

  await Promise.all(
    Object.values(AUTH_KEYS).map((key) => SecureStore.deleteItemAsync(key))
  )
  await clearCachedSessionRoute()

  authDebug("clear-session:done")
}

export async function getLastKnownAuthenticatedRoute() {
  return (await getCachedSessionRoute()) || "/(app)/(tabs)"
}

export async function waitForStoredAuth(timeoutMs = 3000) {
  authDebug("wait-for-stored-auth:start", { timeoutMs })
  const startedAt = Date.now()

  while (Date.now() - startedAt < timeoutMs) {
    await authClient.getSession()

    const stored = await getStoredAuth()
    if (stored?.token) {
      authDebug("wait-for-stored-auth:found", {
        source: stored.source,
        userId: stored.userId,
        elapsedMs: Date.now() - startedAt,
      })
      return stored
    }

    await new Promise((resolve) => setTimeout(resolve, 250))
  }

  authDebug("wait-for-stored-auth:timeout", {
    elapsedMs: Date.now() - startedAt,
  })
  return null
}

async function readJson(key: string) {
  const value = await SecureStore.getItemAsync(key)

  if (!value) {
    return null
  }

  try {
    return JSON.parse(value) as unknown
  } catch {
    return null
  }
}

function extractToken(value: unknown): string | null {
  if (!value || typeof value !== "object") {
    return null
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const token = extractToken(item)
      if (token) return token
    }
    return null
  }

  const record = value as Record<string, unknown>
  const directToken = getString(record.token) || getString(record.sessionToken)

  if (directToken) {
    return normalizeSessionToken(directToken)
  }

  return (
    extractToken(record.session) ||
    extractToken(record.data) ||
    extractToken(record.value)
  )
}

function extractUserId(value: unknown): string | null {
  if (!value || typeof value !== "object") {
    return null
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const userId = extractUserId(item)
      if (userId) return userId
    }
    return null
  }

  const record = value as Record<string, unknown>
  const directUserId = getString(record.userId)

  if (directUserId) {
    return directUserId
  }

  const nestedUser = record.user
  if (
    nestedUser &&
    typeof nestedUser === "object" &&
    !Array.isArray(nestedUser)
  ) {
    const nestedId = getString((nestedUser as Record<string, unknown>).id)
    if (nestedId) {
      return nestedId
    }
  }

  return extractUserId(record.session)
}

function extractTokenFromCookie(cookie: string | null) {
  if (!cookie) {
    return null
  }

  const matchingCookie = cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => /session|token/i.test(part.split("=")[0] ?? ""))

  if (!matchingCookie) {
    return null
  }

  const [, value] = matchingCookie.split("=")
  return normalizeSessionToken(value ? decodeURIComponent(value) : null)
}

function normalizeSessionToken(value: string | null | undefined) {
  const token = value
    ?.trim()
    .replace(/^Bearer\s+/i, "")
    .split(".")[0]
  return token || null
}

function getString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null
}
