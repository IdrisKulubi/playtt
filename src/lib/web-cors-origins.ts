const OFFICIAL_PLAYTT_ORIGINS = [
  "https://www.theplaytt.com",
  "https://theplaytt.com",
] as const

const DEVELOPMENT_WEB_ORIGIN = "http://localhost:3000"

function isLoopbackHostname(value: string) {
  const hostname = value
    .toLowerCase()
    .replace(/^\[/, "")
    .replace(/\]$/, "")
    .replace(/\.$/, "")

  return (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname === "0.0.0.0" ||
    hostname === "::1" ||
    hostname === "0:0:0:0:0:0:0:1" ||
    /^127(?:\.\d{1,3}){3}$/.test(hostname)
  )
}

function parseConfiguredOrigins(
  value: string | undefined,
  production: boolean,
) {
  if (!value) {
    return []
  }

  return value
    .split(",")
    .map((origin) => origin.trim())
    .flatMap((origin) => {
      if (!origin || origin.includes("*")) {
        return []
      }

      try {
        const parsed = new URL(origin)
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
          return []
        }
        if (parsed.username || parsed.password) {
          return []
        }
        if (parsed.pathname !== "/" || parsed.search || parsed.hash) {
          return []
        }
        if (
          production &&
          (parsed.protocol !== "https:" || isLoopbackHostname(parsed.hostname))
        ) {
          return []
        }

        return [parsed.origin]
      } catch {
        return []
      }
    })
}

export function resolveWebCorsOrigins(input: {
  betterAuthUrl?: string
  environment?: string
  nextPublicAppUrl?: string
  webCorsOrigins?: string
}) {
  const production = input.environment === "production"

  return Array.from(
    new Set([
      ...OFFICIAL_PLAYTT_ORIGINS,
      ...(production ? [] : [DEVELOPMENT_WEB_ORIGIN]),
      ...parseConfiguredOrigins(input.webCorsOrigins, production),
      ...parseConfiguredOrigins(input.nextPublicAppUrl, production),
      ...parseConfiguredOrigins(input.betterAuthUrl, production),
    ]),
  )
}

export const WEB_CORS_ORIGINS = resolveWebCorsOrigins({
  betterAuthUrl: process.env.BETTER_AUTH_URL,
  environment: process.env.NODE_ENV,
  nextPublicAppUrl: process.env.NEXT_PUBLIC_APP_URL,
  webCorsOrigins: process.env.WEB_CORS_ORIGINS,
})
