type AuthDebugPayload = Record<string, unknown>

const PREFIX = "[PlayTT Auth]"

const SENSITIVE_KEYS = new Set([
  "token",
  "identityToken",
  "authorizationCode",
  "password",
  "authorization",
  "cookie",
])

function maskValue(value: string) {
  if (value.length <= 8) {
    return "***"
  }

  return `${value.slice(0, 4)}…${value.slice(-4)} (${value.length} chars)`
}

function sanitizePayload(payload?: AuthDebugPayload) {
  if (!payload) {
    return undefined
  }

  return Object.fromEntries(
    Object.entries(payload).map(([key, value]) => {
      if (
        SENSITIVE_KEYS.has(key) &&
        typeof value === "string"
      ) {
        return [key, maskValue(value)]
      }

      if (value instanceof Error) {
        return [
          key,
          {
            name: value.name,
            message: value.message,
          },
        ]
      }

      return [key, value]
    }),
  )
}

export function authDebug(step: string, payload?: AuthDebugPayload) {
  if (!__DEV__) {
    return
  }

  if (payload) {
    console.log(PREFIX, step, sanitizePayload(payload))
    return
  }

  console.log(PREFIX, step)
}

export function authDebugError(step: string, error: unknown, payload?: AuthDebugPayload) {
  if (!__DEV__) {
    return
  }

  const errorPayload =
    error instanceof Error
      ? { name: error.name, message: error.message, stack: error.stack }
      : { message: String(error) }

  console.warn(PREFIX, step, {
    ...sanitizePayload(payload),
    error: errorPayload,
  })
}
