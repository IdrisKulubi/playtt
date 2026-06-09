import { betterFetch } from "@better-fetch/fetch"
import { decodeJwt, decodeProtectedHeader, importJWK, jwtVerify } from "jose"

export type VerifiedAppleToken = {
  sub: string
  email: string | null
  emailVerified: boolean
}

function buildAllowedAudiences() {
  return [
    ...new Set(
      [
        process.env.APPLE_APP_BUNDLE_IDENTIFIER?.trim(),
        process.env.APPLE_EXPO_CLIENT_ID?.trim(),
        process.env.APPLE_CLIENT_ID?.trim(),
      ].filter((value): value is string => Boolean(value)),
    ),
  ]
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

    const { data } = await betterFetch("https://appleid.apple.com/auth/keys")
    const keys = (data as { keys?: Array<Record<string, unknown>> } | null)?.keys
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
