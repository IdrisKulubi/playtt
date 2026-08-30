import { execFile } from "node:child_process"
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises"
import { dirname } from "node:path"
import { promisify } from "node:util"

import {
  type DpapiScope,
  resolveDpapiEntropyPath,
  resolveDpapiScope,
} from "../config/install-layout"

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

function scopeToPowerShell(scope: DpapiScope): string {
  return scope === "localMachine"
    ? "LocalMachine"
    : "CurrentUser"
}

async function readEntropyBase64(entropyPath: string | null): Promise<string | null> {
  if (!entropyPath) {
    return null
  }

  try {
    const entropy = await readFile(entropyPath)
    if (entropy.length === 0) {
      throw new SecretStoreUnavailableError(
        "DPAPI entropy file is empty.",
      )
    }

    return entropy.toString("base64")
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new SecretStoreUnavailableError(
        "DPAPI entropy file is missing for LocalMachine protected storage.",
      )
    }

    throw error
  }
}

async function protectWithDpapi(
  plaintext: string,
  scope: DpapiScope,
  entropyPath: string | null,
): Promise<string> {
  const inputBase64 = Buffer.from(plaintext, "utf8").toString("base64")
  const entropyBase64 =
    scope === "localMachine" ? await readEntropyBase64(entropyPath) : null

  const entropyArg = entropyBase64
    ? `$entropy = [Convert]::FromBase64String('${entropyBase64}')`
    : "$entropy = $null"

  const script = `
Add-Type -AssemblyName System.Security
$bytes = [Convert]::FromBase64String('${inputBase64}')
${entropyArg}
$protected = [System.Security.Cryptography.ProtectedData]::Protect(
  $bytes,
  $entropy,
  [System.Security.Cryptography.DataProtectionScope]::${scopeToPowerShell(scope)}
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

async function unprotectWithDpapi(
  base64: string,
  scope: DpapiScope,
  entropyPath: string | null,
): Promise<string> {
  const entropyBase64 =
    scope === "localMachine" ? await readEntropyBase64(entropyPath) : null

  const entropyArg = entropyBase64
    ? `$entropy = [Convert]::FromBase64String('${entropyBase64}')`
    : "$entropy = $null"

  const script = `
Add-Type -AssemblyName System.Security
$bytes = [Convert]::FromBase64String('${base64.replace(/'/g, "''")}')
${entropyArg}
$unprotected = [System.Security.Cryptography.ProtectedData]::Unprotect(
  $bytes,
  $entropy,
  [System.Security.Cryptography.DataProtectionScope]::${scopeToPowerShell(scope)}
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
  constructor(
    private readonly blobPath: string,
    private readonly scope: DpapiScope,
    private readonly entropyPath: string | null,
  ) {}

  async get(): Promise<StoredDeviceSecret | null> {
    try {
      const encoded = await readFile(this.blobPath, "utf8")
      const json = await unprotectWithDpapi(
        encoded.trim(),
        this.scope,
        this.entropyPath,
      )
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
      const encoded = await protectWithDpapi(
        JSON.stringify(value),
        this.scope,
        this.entropyPath,
      )
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

  if (explicit) {
    throw new SecretStoreUnavailableError(
      `Unknown VENUE_EDGE_SECRET_STORE=${explicit}. Use memory or dpapi.`,
    )
  }

  // Local wizard / simulate / buffer: start without extra env. Pairing lives
  // in process memory until restart. Production still requires DPAPI.
  if (mode === "production") {
    return "dpapi"
  }

  return "memory"
}

export function createProtectedSecretStore(input: {
  mode: SecretStoreMode
  blobPath: string
  venueMode?: string
  dataDir?: string
  dpapiScope?: DpapiScope
  entropyPath?: string | null
}): ProtectedSecretStore {
  if (input.mode === "memory") {
    return new MemorySecretStore()
  }

  if (process.platform !== "win32") {
    throw new SecretStoreUnavailableError(
      "DPAPI secret storage is only available on Windows.",
    )
  }

  const venueMode = input.venueMode ?? "production"
  const scope = input.dpapiScope ?? resolveDpapiScope(venueMode)
  const entropyPath =
    input.entropyPath ??
    (scope === "localMachine" && input.dataDir
      ? resolveDpapiEntropyPath(input.dataDir)
      : null)

  return new DpapiSecretStore(input.blobPath, scope, entropyPath)
}
