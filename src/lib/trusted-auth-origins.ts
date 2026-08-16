const PLAYTT_MOBILE_ORIGINS = [
  "playtt://",
  "playtt:///",
  "playtt://*",
  "playtt://**",
] as const

const EXPO_DEVELOPMENT_ORIGINS = [
  "exp://",
  "exp://*",
  "exp://**",
  "exps://",
  "exps://*",
  "exps://**",
  "exp://localhost:8081",
  "exp://localhost:8082",
  "exps://localhost:8081",
  "exps://localhost:8082",
  "exp://192.168.*.*:*/**",
  "exps://192.168.*.*:*/**",
  "exp://10.*.*.*:*/**",
  "exps://10.*.*.*:*/**",
  "exp://172.*.*.*:*/**",
  "exps://172.*.*.*:*/**",
] as const

const APPLE_ORIGIN = "https://appleid.apple.com"
const MOBILE_CALLBACK_PROTOCOLS = new Set(["exp:", "exps:", "playtt:"])

function parseExactMobileCallbacks(value: string | undefined) {
  if (!value) {
    return []
  }

  return value
    .split(",")
    .map((callback) => callback.trim())
    .filter((callback) => {
      if (!callback || callback.includes("*")) {
        return false
      }

      try {
        const parsed = new URL(callback)
        if (!MOBILE_CALLBACK_PROTOCOLS.has(parsed.protocol)) {
          return false
        }

        return parsed.protocol === "playtt:" || Boolean(parsed.hostname)
      } catch {
        return false
      }
    })
}

export function resolveTrustedAuthOrigins(input: {
  environment?: string
  mobileAuthCallbackUrls?: string
  trustExpoGo?: string
  webOrigins: readonly string[]
}) {
  const includeExpoDevelopmentOrigins =
    input.environment !== "production" ||
    input.trustExpoGo?.trim().toLowerCase() === "true"

  return Array.from(
    new Set([
      ...input.webOrigins,
      ...PLAYTT_MOBILE_ORIGINS,
      ...(includeExpoDevelopmentOrigins ? EXPO_DEVELOPMENT_ORIGINS : []),
      ...parseExactMobileCallbacks(input.mobileAuthCallbackUrls),
      APPLE_ORIGIN,
    ]),
  )
}
