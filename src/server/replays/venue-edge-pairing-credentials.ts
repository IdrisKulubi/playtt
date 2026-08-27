import { createHash, randomBytes } from "node:crypto"

import {
  hashDeviceSecret,
  verifyDeviceSecret,
} from "../devices/credentials.ts"

const PAIRING_CODE_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"
const PAIRING_CODE_LENGTH = 10

function pairingPayload(plaintext: string) {
  return `venue-edge-pairing:${plaintext}`
}

export function normalizeVenueEdgePairingCode(input: string) {
  return input.replace(/-/g, "").trim().toUpperCase()
}

export function formatVenueEdgePairingCode(normalized: string) {
  if (normalized.length !== PAIRING_CODE_LENGTH) {
    return normalized
  }

  return `${normalized.slice(0, 4)}-${normalized.slice(4)}`
}

export function generateVenueEdgePairingCode() {
  const bytes = randomBytes(PAIRING_CODE_LENGTH)
  let normalized = ""

  for (let index = 0; index < PAIRING_CODE_LENGTH; index += 1) {
    normalized += PAIRING_CODE_ALPHABET[bytes[index] % PAIRING_CODE_ALPHABET.length]
  }

  return {
    pairingCode: formatVenueEdgePairingCode(normalized),
    normalized,
    codeHint: normalized.slice(-4),
  }
}

export function hashVenueEdgePairingCode(plaintext: string) {
  return hashDeviceSecret(pairingPayload(normalizeVenueEdgePairingCode(plaintext)))
}

export function verifyVenueEdgePairingCode(plaintext: string, codeHash: string) {
  return verifyDeviceSecret(
    pairingPayload(normalizeVenueEdgePairingCode(plaintext)),
    codeHash,
  )
}

export function hashPairingRateLimitSubject(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex")
}
