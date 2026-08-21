import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname } from "node:path"

export interface DeviceCredentials {
  deviceId: string
  secret: string
  credentialVersion?: number
}

const ENCRYPTION_PREFIX = "enc:v1:"

function deriveKey(passphrase: string, salt: Buffer): Buffer {
  return scryptSync(passphrase, salt, 32)
}

function encryptPayload(plaintext: string, passphrase: string): string {
  const salt = randomBytes(16)
  const iv = randomBytes(12)
  const key = deriveKey(passphrase, salt)
  const cipher = createCipheriv("aes-256-gcm", key, iv)
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ])
  const tag = cipher.getAuthTag()

  return `${ENCRYPTION_PREFIX}${salt.toString("hex")}:${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`
}

function decryptPayload(ciphertext: string, passphrase: string): string {
  if (!ciphertext.startsWith(ENCRYPTION_PREFIX)) {
    return ciphertext
  }

  const [, saltHex, ivHex, tagHex, dataHex] = ciphertext.split(":")
  if (!saltHex || !ivHex || !tagHex || !dataHex) {
    throw new Error("Invalid encrypted credential format.")
  }

  const salt = Buffer.from(saltHex, "hex")
  const iv = Buffer.from(ivHex, "hex")
  const tag = Buffer.from(tagHex, "hex")
  const data = Buffer.from(dataHex, "hex")
  const key = deriveKey(passphrase, salt)
  const decipher = createDecipheriv("aes-256-gcm", key, iv)
  decipher.setAuthTag(tag)

  return Buffer.concat([decipher.update(data), decipher.final()]).toString(
    "utf8",
  )
}

export async function loadCredentials(
  path: string,
  options: { encrypt?: boolean } = {},
): Promise<DeviceCredentials | null> {
  try {
    const raw = await readFile(path, "utf8")
    const passphrase = process.env.VENUE_EDGE_CREDENTIAL_PASSPHRASE

    const json =
      options.encrypt && passphrase
        ? decryptPayload(raw.trim(), passphrase)
        : raw

    const parsed = JSON.parse(json) as DeviceCredentials

    if (!parsed.deviceId || !parsed.secret) {
      throw new Error("Credential file is missing deviceId or secret.")
    }

    return parsed
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null
    }

    throw error
  }
}

export async function saveCredentials(
  path: string,
  credentials: DeviceCredentials,
  options: { encrypt?: boolean } = {},
): Promise<void> {
  await mkdir(dirname(path), { recursive: true })

  const plaintext = JSON.stringify(credentials, null, 2)
  const passphrase = process.env.VENUE_EDGE_CREDENTIAL_PASSPHRASE
  const payload =
    options.encrypt && passphrase
      ? encryptPayload(plaintext, passphrase)
      : plaintext

  await writeFile(path, payload, { mode: 0o600 })
}

export function redactCredentialValue(value: string): string {
  if (value.length <= 4) {
    return "[redacted]"
  }

  return `${value.slice(0, 2)}…[redacted]`
}
