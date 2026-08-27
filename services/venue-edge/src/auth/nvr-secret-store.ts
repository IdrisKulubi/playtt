import { join } from "node:path"

import {
  createProtectedSecretStore,
  resolveSecretStoreMode,
  type ProtectedSecretStore,
  SecretStoreUnavailableError,
} from "./secret-store"

export interface NvrPasswordStore {
  has(localConnectionKey: string): Promise<boolean>
  get(localConnectionKey: string): Promise<string | null>
  set(localConnectionKey: string, password: string): Promise<void>
  delete(localConnectionKey: string): Promise<void>
}

function safeBlobName(localConnectionKey: string): string {
  return localConnectionKey.replace(/[^a-zA-Z0-9._-]/g, "_")
}

class PerKeyNvrPasswordStore implements NvrPasswordStore {
  private readonly stores = new Map<string, ProtectedSecretStore>()

  constructor(
    private readonly nvrsDir: string,
    private readonly secretStoreMode: string,
    private readonly venueMode: string,
  ) {}

  private resolveStore(localConnectionKey: string): ProtectedSecretStore {
    const cached = this.stores.get(localConnectionKey)
    if (cached) {
      return cached
    }

    const mode = resolveSecretStoreMode(
      this.venueMode,
      this.secretStoreMode === "" ? null : this.secretStoreMode,
    )
    const blobPath = join(
      this.nvrsDir,
      `${safeBlobName(localConnectionKey)}.dpapi`,
    )
    const store = createProtectedSecretStore({ mode, blobPath })
    this.stores.set(localConnectionKey, store)
    return store
  }

  async has(localConnectionKey: string): Promise<boolean> {
    const stored = await this.resolveStore(localConnectionKey).get()
    return Boolean(stored?.secret)
  }

  async get(localConnectionKey: string): Promise<string | null> {
    const stored = await this.resolveStore(localConnectionKey).get()
    return stored?.secret ?? null
  }

  async set(localConnectionKey: string, password: string): Promise<void> {
    if (!password) {
      throw new SecretStoreUnavailableError("NVR password cannot be empty.")
    }

    await this.resolveStore(localConnectionKey).set({ secret: password })
  }

  async delete(localConnectionKey: string): Promise<void> {
    await this.resolveStore(localConnectionKey).delete()
    this.stores.delete(localConnectionKey)
  }
}

export function createNvrPasswordStore(input: {
  dataDir: string
  secretStoreMode: string
  venueMode: string
}): NvrPasswordStore {
  return new PerKeyNvrPasswordStore(
    join(input.dataDir, "nvrs"),
    input.secretStoreMode,
    input.venueMode,
  )
}
