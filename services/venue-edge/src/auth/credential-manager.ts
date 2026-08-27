import { mkdir, readFile, unlink, writeFile } from "node:fs/promises"
import { dirname } from "node:path"

import type { DeviceCredentials } from "./credentials"
import {
  createProtectedSecretStore,
  resolveSecretStoreMode,
  SecretStoreUnavailableError,
  type ProtectedSecretStore,
} from "./secret-store"

export interface InstallationMetadata {
  deviceId: string
  credentialVersion?: number
  installationUid?: string
  revokedAt?: string
}

export class CredentialManager {
  private readonly secretStore: ProtectedSecretStore

  constructor(
    private readonly installationPath: string,
    private readonly secretBlobPath: string,
    secretStoreMode: string,
    venueMode: string,
    dataDir?: string,
  ) {
    const mode = resolveSecretStoreMode(
      venueMode,
      secretStoreMode === "" ? null : secretStoreMode,
    )
    this.secretStore = createProtectedSecretStore({
      mode,
      blobPath: secretBlobPath,
      venueMode,
      dataDir,
    })
  }

  static fromEnv(env: {
    dataDir: string
    mode: string
    secretStoreMode: string
    installationPath: string
    secretBlobPath: string
  }): CredentialManager {
    return new CredentialManager(
      env.installationPath,
      env.secretBlobPath,
      env.secretStoreMode,
      env.mode,
      env.dataDir,
    )
  }

  async isRevoked(): Promise<boolean> {
    const metadata = await this.readInstallationMetadata()
    return Boolean(metadata?.revokedAt)
  }

  async loadCredentials(): Promise<DeviceCredentials | null> {
    if (await this.isRevoked()) {
      return null
    }

    const metadata = await this.readInstallationMetadata()
    const stored = await this.secretStore.get()

    if (!metadata?.deviceId || !stored?.secret) {
      return null
    }

    return {
      deviceId: metadata.deviceId,
      secret: stored.secret,
      credentialVersion:
        stored.credentialVersion ?? metadata.credentialVersion ?? undefined,
      ...(metadata.installationUid
        ? { installationUid: metadata.installationUid }
        : {}),
    }
  }

  async loadInstallationMetadata(): Promise<InstallationMetadata | null> {
    return this.readInstallationMetadata()
  }

  async persistCredentials(credentials: DeviceCredentials): Promise<void> {
    if (!credentials.deviceId || !credentials.secret) {
      throw new SecretStoreUnavailableError(
        "Device credentials must include deviceId and secret.",
      )
    }

    const current = await this.readInstallationMetadata()

    await this.writeInstallationMetadata({
      deviceId: credentials.deviceId,
      credentialVersion: credentials.credentialVersion,
      installationUid:
        credentials.installationUid ?? current?.installationUid,
      revokedAt: undefined,
    })

    await this.secretStore.set({
      secret: credentials.secret,
      credentialVersion: credentials.credentialVersion,
    })
  }

  async wipeAfterRevoke(): Promise<void> {
    await this.secretStore.delete()
    const metadata = await this.readInstallationMetadata()
    if (metadata) {
      await this.writeInstallationMetadata({
        ...metadata,
        revokedAt: new Date().toISOString(),
      })
    }
  }

  private async readInstallationMetadata(): Promise<InstallationMetadata | null> {
    try {
      const raw = await readFile(this.installationPath, "utf8")
      const parsed = JSON.parse(raw) as InstallationMetadata

      if (!parsed.deviceId) {
        throw new SecretStoreUnavailableError(
          "Installation metadata is missing deviceId.",
        )
      }

      return parsed
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return null
      }

      throw error
    }
  }

  private async writeInstallationMetadata(
    metadata: InstallationMetadata,
  ): Promise<void> {
    await mkdir(dirname(this.installationPath), { recursive: true })
    const payload = {
      deviceId: metadata.deviceId,
      credentialVersion: metadata.credentialVersion,
      installationUid: metadata.installationUid,
      revokedAt: metadata.revokedAt,
    }
    await writeFile(
      this.installationPath,
      `${JSON.stringify(payload, null, 2)}\n`,
      { mode: 0o600 },
    )
  }

  async updateInstallationMetadata(
    patch: Partial<InstallationMetadata>,
  ): Promise<void> {
    const current = await this.readInstallationMetadata()
    if (!current) {
      throw new SecretStoreUnavailableError(
        "Installation metadata is not available.",
      )
    }

    await this.writeInstallationMetadata({
      ...current,
      ...patch,
    })
  }

  async deleteLegacyPlaintextFile(path: string): Promise<void> {
    try {
      await unlink(path)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error
      }
    }
  }
}
