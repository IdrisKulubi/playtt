import { decodeJwt, decodeProtectedHeader, importJWK, jwtVerify } from "jose"

/** Apple JWT audience when signing in via Expo Go (not an EAS/production bundle). */
export const EXPO_GO_APPLE_AUDIENCE = "host.exp.Exponent"

export type VerifiedAppleToken = {
  sub: string
  email: string | null
  emailVerified: boolean
}

function getExpoAppleAudience() {
  return process.env.APPLE_EXPO_CLIENT_ID?.trim() || EXPO_GO_APPLE_AUDIENCE
}

function buildAllowedAudiences() {
  return [
    ...new Set(
      [
        process.env.APPLE_APP_BUNDLE_IDENTIFIER?.trim(),
        getExpoAppleAudience(),
        process.env.APPLE_CLIENT_ID?.trim(),
      ].filter((value): value is string => Boolean(value)),
    ),
  ]
}

export function getAppleExpoClientId() {
  return getExpoAppleAudience()
}

export function getAppleAllowedAudiences() {
  return buildAllowedAudiences()
}

export async function verifyAppleToken(
  identityToken: string,
): Promise<VerifiedAppleToken | null> {
  const allowedAudiences = buildAllowedAudiences()

  if (allowedAudiences.length === 0) {
    console.error("[APPLE AUTH] No allowed audiences configured")
    return null
  }

  try {
    const { kid, alg } = decodeProtectedHeader(identityToken)
    if (!kid || !alg) {
      return null
    }

    const response = await fetch("https://appleid.apple.com/auth/keys")
    if (!response.ok) {
      console.error("[APPLE AUTH] Failed to fetch Apple JWKS:", response.status)
      return null
    }

    const data = (await response.json()) as {
      keys?: Array<Record<string, unknown>>
    }
    const keys = data.keys
    const jwk = keys?.find((key) => key.kid === kid)

    if (!jwk) {
      console.error("[APPLE AUTH] JWK not found for kid:", kid)
      return null
    }

    const publicKey = await importJWK(jwk, jwk.alg as string)
    const { payload } = await jwtVerify(identityToken, publicKey, {
      algorithms: [alg],
      issuer: "https://appleid.apple.com",
      audience: allowedAudiences,
    })

    const email =
      typeof payload.email === "string" && payload.email.trim()
        ? payload.email.trim().toLowerCase()
        : null

    const emailVerified =
      payload.email_verified === true || payload.email_verified === "true"

    if (typeof payload.sub !== "string" || !payload.sub) {
      return null
    }

    return {
      sub: payload.sub,
      email,
      emailVerified,
    }
  } catch (error) {
    const aud = safeDecodeAudience(identityToken)
    console.error("[APPLE AUTH] Token verification failed", {
      aud,
      allowedAudiences,
      error,
    })
    return null
  }
}

function safeDecodeAudience(identityToken: string) {
  try {
    const payload = decodeJwt(identityToken)
    return payload.aud ?? null
  } catch {
    return null
  }
}
