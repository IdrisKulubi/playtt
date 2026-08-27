import { execFile } from "node:child_process"
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises"
import { dirname } from "node:path"
import { promisify } from "node:util"

const execFileAsync = promisify(execFile)

export interface StoredDeviceSecret {
  secret: string
  credentialVersion?: number
}

export interface ProtectedSecretStore {
  get(): Promise<StoredDeviceSecret | null>
  set(value: StoredDeviceSecret): Promise<void>
  delete(): Promise<void>
}

export class SecretStoreUnavailableError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "SecretStoreUnavailableError"
  }
}

export class MemorySecretStore implements ProtectedSecretStore {
  private value: StoredDeviceSecret | null = null

  async get(): Promise<StoredDeviceSecret | null> {
    return this.value ? { ...this.value } : null
  }

  async set(value: StoredDeviceSecret): Promise<void> {
    this.value = { ...value }
  }

  async delete(): Promise<void> {
    this.value = null
  }
}

async function protectWithDpapi(plaintext: string): Promise<string> {
  const inputBase64 = Buffer.from(plaintext, "utf8").toString("base64")
  const script = `
Add-Type -AssemblyName System.Security
$bytes = [Convert]::FromBase64String('${inputBase64}')
$protected = [System.Security.Cryptography.ProtectedData]::Protect(
  $bytes,
  $null,
  [System.Security.Cryptography.DataProtectionScope]::CurrentUser
)
[Convert]::ToBase64String($protected)
`

  const { stdout } = await execFileAsync(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-Command", script],
    { windowsHide: true, maxBuffer: 1024 * 1024 },
  )

  return stdout.trim()
}

async function unprotectWithDpapi(base64: string): Promise<string> {
  const script = `
Add-Type -AssemblyName System.Security
$bytes = [Convert]::FromBase64String('${base64.replace(/'/g, "''")}')
$unprotected = [System.Security.Cryptography.ProtectedData]::Unprotect(
  $bytes,
  $null,
  [System.Security.Cryptography.DataProtectionScope]::CurrentUser
)
[Convert]::ToBase64String($unprotected)
`

  const { stdout } = await execFileAsync(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-Command", script],
    { windowsHide: true, maxBuffer: 1024 * 1024 },
  )

  const plaintext = Buffer.from(stdout.trim(), "base64").toString("utf8")
  return plaintext
}

export class DpapiSecretStore implements ProtectedSecretStore {
  constructor(private readonly blobPath: string) {}

  async get(): Promise<StoredDeviceSecret | null> {
    try {
      const encoded = await readFile(this.blobPath, "utf8")
      const json = await unprotectWithDpapi(encoded.trim())
      const parsed = JSON.parse(json) as StoredDeviceSecret

      if (!parsed.secret) {
        throw new SecretStoreUnavailableError(
          "Protected credential blob is missing a secret.",
        )
      }

      return parsed
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return null
      }

      throw new SecretStoreUnavailableError(
        error instanceof Error
          ? error.message
          : "Failed to read protected credential store.",
      )
    }
  }

  async set(value: StoredDeviceSecret): Promise<void> {
    if (!value.secret) {
      throw new SecretStoreUnavailableError(
        "Cannot persist an empty device secret.",
      )
    }

    try {
      await mkdir(dirname(this.blobPath), { recursive: true })
      const encoded = await protectWithDpapi(JSON.stringify(value))
      await writeFile(this.blobPath, `${encoded}\n`, { mode: 0o600 })
    } catch (error) {
      throw new SecretStoreUnavailableError(
        error instanceof Error
          ? error.message
          : "Failed to write protected credential store.",
      )
    }
  }

  async delete(): Promise<void> {
    try {
      await unlink(this.blobPath)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error
      }
    }
  }
}

export type SecretStoreMode = "memory" | "dpapi"

export function resolveSecretStoreMode(
  mode: string,
  explicit?: string | null,
): SecretStoreMode {
  if (explicit === "memory") {
    return "memory"
  }

  if (explicit === "dpapi") {
    return "dpapi"
  }

  if (mode === "production") {
    return "dpapi"
  }

  throw new SecretStoreUnavailableError(
    "Protected secret storage is not configured. Set VENUE_EDGE_SECRET_STORE=memory for non-production test runs.",
  )
}

export function createProtectedSecretStore(input: {
  mode: SecretStoreMode
  blobPath: string
}): ProtectedSecretStore {
  if (input.mode === "memory") {
    return new MemorySecretStore()
  }

  if (process.platform !== "win32") {
    throw new SecretStoreUnavailableError(
      "DPAPI secret storage is only available on Windows.",
    )
  }

  return new DpapiSecretStore(input.blobPath)
}
