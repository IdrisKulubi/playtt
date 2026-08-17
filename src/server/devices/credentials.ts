import { createHmac, randomBytes, timingSafeEqual } from "node:crypto"

const DEV_FALLBACK_SECRET = "playtt-dev-device-credential-secret"

export function getDeviceCredentialPepper() {
  const secret =
    process.env.DEVICE_CREDENTIAL_SECRET ??
    (process.env.NODE_ENV === "production" ? undefined : DEV_FALLBACK_SECRET)

  if (!secret) {
    throw new Error("DEVICE_CREDENTIAL_SECRET is required in production.")
  }

  return secret
}

export function hashDeviceSecret(plaintext: string) {
  return createHmac("sha256", getDeviceCredentialPepper())
    .update(plaintext, "utf8")
    .digest("hex")
}

export function verifyDeviceSecret(plaintext: string, secretHash: string) {
  const expected = hashDeviceSecret(plaintext)
  const expectedBuffer = Buffer.from(expected, "hex")
  const actualBuffer = Buffer.from(secretHash, "hex")

  if (expectedBuffer.length !== actualBuffer.length) {
    return false
  }

  return timingSafeEqual(expectedBuffer, actualBuffer)
}

export function generateEnrollmentCode() {
  return randomBytes(12).toString("base64url")
}

export function generateDeviceSecret() {
  return randomBytes(32).toString("base64url")
}

export function hashEnrollmentCode(plaintext: string) {
  return hashDeviceSecret(`enrollment:${plaintext}`)
}

export function verifyEnrollmentCode(plaintext: string, codeHash: string) {
  return verifyDeviceSecret(`enrollment:${plaintext}`, codeHash)
}
