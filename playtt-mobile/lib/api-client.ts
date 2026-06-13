import { ApiError } from "@/lib/api-error"
import { authDebug, authDebugError } from "@/lib/auth-debug"
import { formatApiFailure, getFriendlyErrorMessage } from "@/lib/api-errors"
import { getApiBaseUrl } from "@/lib/env"
import { getAuthToken } from "@/lib/auth-helpers"

export { ApiError } from "@/lib/api-error"

const AUTH_FAILURE_CODES = new Set([
  "SESSION_EXPIRED",
  "INVALID_TOKEN",
  "UNAUTHENTICATED",
  "USER_DELETED",
  "USER_BANNED",
])

let sessionExpiredHandler: (() => void | Promise<void>) | null = null

export function setSessionExpiredHandler(handler: () => void | Promise<void>) {
  sessionExpiredHandler = handler
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit & { timeoutMs?: number } = {}
): Promise<T> {
  const timeoutMs = init.timeoutMs ?? 15000
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const token = await getAuthToken()
    const headers = new Headers(init.headers)

    if (!headers.has("content-type") && init.body) {
      headers.set("content-type", "application/json")
    }

    if (token) {
      headers.set("authorization", `Bearer ${token}`)
    }

    authDebug("api-fetch:start", {
      path,
      hasToken: Boolean(token),
      tokenLength: token?.length,
    })

    const response = await fetch(`${getApiBaseUrl()}${path}`, {
      ...init,
      headers,
      signal: controller.signal,
    })

    const data = await readResponse(response)

    if (!response.ok) {
      const code = getResponseCode(data)
      const rawMessage =
        getResponseMessage(data) ||
        `Request failed with status ${response.status}`
      const error = new ApiError({
        status: response.status,
        code,
        data,
        message: formatApiFailure({
          status: response.status,
          code,
          message: rawMessage,
        }),
      })

      if (token && shouldClearSession(error)) {
        authDebugError("api-fetch:session-expired", error, {
          path,
          status: error.status,
          code: error.code,
        })
        await sessionExpiredHandler?.()
      }

      throw error
    }

    return data as T
  } catch (error) {
    if (error instanceof ApiError) {
      throw error
    }

    if (error instanceof Error && error.name === "AbortError") {
      throw new ApiError({
        status: 408,
        code: "TIMEOUT",
        message: formatApiFailure({
          status: 408,
          code: "TIMEOUT",
          message: "Request timed out.",
        }),
        data: null,
      })
    }

    if (
      error instanceof TypeError ||
      (error instanceof Error && error.message.toLowerCase().includes("network"))
    ) {
      throw new ApiError({
        status: 0,
        code: "NETWORK_ERROR",
        message: getFriendlyErrorMessage(error),
        data: null,
      })
    }

    throw error
  } finally {
    clearTimeout(timeoutId)
  }
}

function shouldClearSession(error: ApiError) {
  if (error.code && AUTH_FAILURE_CODES.has(error.code)) {
    return true
  }

  return error.status === 401 && error.code === "UNAUTHENTICATED"
}

async function readResponse(response: Response) {
  const text = await response.text()

  if (!text) {
    return null
  }

  try {
    return JSON.parse(text) as unknown
  } catch {
    return text
  }
}

function getResponseCode(data: unknown) {
  if (!data || typeof data !== "object") {
    return undefined
  }

  const record = data as Record<string, unknown>
  return typeof record.code === "string" ? record.code : undefined
}

function getResponseMessage(data: unknown) {
  if (!data || typeof data !== "object") {
    return null
  }

  const record = data as Record<string, unknown>
  return typeof record.message === "string" ? record.message : null
}
