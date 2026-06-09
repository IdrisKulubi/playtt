function parseOrigins(value: string | undefined) {
  return (
    value
      ?.split(",")
      .map((origin) => origin.trim())
      .filter(Boolean) ?? []
  )
}

export function isExpoGoTrusted() {
  return process.env.BETTER_AUTH_TRUST_EXPO_GO === "true"
}

export function buildAppleAudience() {
  const audiences = new Set(
    [
      process.env.APPLE_APP_BUNDLE_IDENTIFIER?.trim(),
      process.env.APPLE_CLIENT_ID?.trim(),
      ...parseOrigins(process.env.APPLE_EXTRA_AUDIENCES),
      isExpoGoTrusted() ? "host.exp.Exponent" : null,
    ].filter(Boolean),
  )

  return [...audiences]
}
