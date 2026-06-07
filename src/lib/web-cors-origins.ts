const DEFAULT_WEB_ORIGINS = [
  "http://localhost:3000",
  "https://www.theplaytt.com",
  "https://theplaytt.com",
]

export const WEB_CORS_ORIGINS = [
  ...DEFAULT_WEB_ORIGINS,
  ...parseOrigins(process.env.WEB_CORS_ORIGINS),
  ...parseOrigins(process.env.NEXT_PUBLIC_APP_URL),
  ...parseOrigins(process.env.BETTER_AUTH_URL),
]

function parseOrigins(value: string | undefined) {
  return (
    value
      ?.split(",")
      .map((origin) => origin.trim())
      .filter(Boolean) ?? []
  )
}
