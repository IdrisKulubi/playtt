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

export function buildAppleAudience(): string[] {
  const candidates = [
    process.env.APPLE_APP_BUNDLE_IDENTIFIER?.trim(),
    process.env.APPLE_CLIENT_ID?.trim(),
    ...parseOrigins(process.env.APPLE_EXTRA_AUDIENCES),
    isExpoGoTrusted() ? "host.exp.Exponent" : null,
  ]

  return [
    ...new Set(
      candidates.filter((value): value is string => Boolean(value)),
    ),
  ]
}
