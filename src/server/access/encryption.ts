import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto"

const ALGORITHM = "aes-256-gcm"
const IV_BYTES = 12

export interface CredentialKeyring {
  current: string
  keys: Map<string, Buffer>
}

export function accessGrantSecretAad(tenantId: string, grantId: string) {
  return `playtt:access-grant:${tenantId}:${grantId}:code`
}

export function ttlockConnectionSecretAad(
  tenantId: string,
  connectionId: string,
  purpose: "client-secret" | "access-token" | "refresh-token",
) {
  return `playtt:ttlock-connection:${tenantId}:${connectionId}:${purpose}`
}

function decodeKey(value: string, keyId: string) {
  const key = Buffer.from(value, "base64")
  if (key.byteLength !== 32) {
    throw new Error(`Credential encryption key ${keyId} must decode to 32 bytes.`)
  }
  return key
}

export function parseCredentialKeyring(raw = process.env.PLAYTT_CREDENTIAL_ENCRYPTION_KEYS) {
  if (!raw?.trim()) {
    throw new Error("PLAYTT_CREDENTIAL_ENCRYPTION_KEYS is not configured.")
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (error) {
    throw new Error("PLAYTT_CREDENTIAL_ENCRYPTION_KEYS must be valid JSON.", {
      cause: error,
    })
  }

  if (
    !parsed ||
    typeof parsed !== "object" ||
    !("current" in parsed) ||
    !("keys" in parsed) ||
    typeof parsed.current !== "string" ||
    !parsed.keys ||
    typeof parsed.keys !== "object"
  ) {
    throw new Error("Credential keyring must contain current and keys.")
  }

  const keys = new Map(
    Object.entries(parsed.keys).map(([keyId, value]) => {
      if (typeof value !== "string") {
        throw new Error(`Credential encryption key ${keyId} must be base64 text.`)
      }
      return [keyId, decodeKey(value, keyId)] as const
    }),
  )

  if (!keys.has(parsed.current)) {
    throw new Error("Credential keyring current key is missing from keys.")
  }

  return { current: parsed.current, keys } satisfies CredentialKeyring
}

export function encryptCredentialSecret(
  plaintext: string,
  aad: string,
  keyring = parseCredentialKeyring(),
) {
  const key = keyring.keys.get(keyring.current)
  if (!key) throw new Error("Current credential encryption key is unavailable.")

  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  cipher.setAAD(Buffer.from(aad, "utf8"))
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ])
  const tag = cipher.getAuthTag()

  return [
    keyring.current,
    iv.toString("base64url"),
    tag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".")
}

export function decryptCredentialSecret(
  envelope: string,
  aad: string,
  keyring = parseCredentialKeyring(),
) {
  const [keyId, ivText, tagText, ciphertextText, ...extra] = envelope.split(".")
  if (!keyId || !ivText || !tagText || !ciphertextText || extra.length > 0) {
    throw new Error("Encrypted credential envelope is malformed.")
  }

  const key = keyring.keys.get(keyId)
  if (!key) throw new Error(`Credential encryption key ${keyId} is unavailable.`)

  const decipher = createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(ivText, "base64url"),
  )
  decipher.setAAD(Buffer.from(aad, "utf8"))
  decipher.setAuthTag(Buffer.from(tagText, "base64url"))

  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextText, "base64url")),
    decipher.final(),
  ]).toString("utf8")
}
