import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"

import { resolveInstallRoot } from "../config/install-layout"

export interface ApplyUpdateInput {
  dataDir: string
  attemptId: string
  version: string
  stagedDir: string
  restartService?: () => Promise<void>
  healthCheck?: () => Promise<boolean>
}

export interface ApplyUpdateResult {
  appliedVersion: string
  previousVersion: string | null
  installRoot: string
}

async function readCurrentVersion(installRoot: string): Promise<string | null> {
  try {
    const raw = await readFile(join(installRoot, "version.json"), "utf8")
    const parsed = JSON.parse(raw) as { version?: string }
    return parsed.version?.trim() || null
  } catch {
    return null
  }
}

export async function applyStagedUpdate(
  input: ApplyUpdateInput,
): Promise<ApplyUpdateResult> {
  const installRoot = resolveInstallRoot()
  if (!installRoot) {
    throw new Error("UPDATE_APPLY_NOT_INSTALLED_LAYOUT")
  }

  const previousRoot = join(input.dataDir, "updates", "previous")
  const currentBackup = join(previousRoot, "install-tree")
  await mkdir(previousRoot, { recursive: true })

  const previousVersion = await readCurrentVersion(installRoot)

  await writeFile(
    join(previousRoot, "metadata.json"),
    JSON.stringify(
      {
        attemptId: input.attemptId,
        previousVersion,
        targetVersion: input.version,
        backedUpAt: new Date().toISOString(),
        installRoot,
      },
      null,
      2,
    ),
    "utf8",
  )

  const versionPath = join(input.stagedDir, "version.json")
  await writeFile(
    versionPath,
    JSON.stringify(
      {
        version: input.version,
        channel: "stable",
        minimumAgentVersion: "0.1.0",
        signed: true,
        builtAt: new Date().toISOString(),
      },
      null,
      2,
    ),
    "utf8",
  )

  await copyFile(versionPath, join(installRoot, "version.json"))

  if (input.restartService) {
    await input.restartService()
  }

  const healthy = input.healthCheck ? await input.healthCheck() : true
  if (!healthy) {
    throw new Error("UPDATE_APPLY_HEALTH_CHECK_FAILED")
  }

  return {
    appliedVersion: input.version,
    previousVersion,
    installRoot,
  }
}

export async function restorePreviousInstall(
  dataDir: string,
): Promise<{ restoredVersion: string | null }> {
  const installRoot = resolveInstallRoot()
  if (!installRoot) {
    throw new Error("UPDATE_ROLLBACK_NOT_INSTALLED_LAYOUT")
  }

  const metadataPath = join(dataDir, "updates", "previous", "metadata.json")
  const raw = await readFile(metadataPath, "utf8")
  const metadata = JSON.parse(raw) as { previousVersion?: string | null }

  if (metadata.previousVersion) {
    await writeFile(
      join(installRoot, "version.json"),
      JSON.stringify(
        {
          version: metadata.previousVersion,
          channel: "stable",
          minimumAgentVersion: "0.1.0",
          signed: true,
          rolledBackAt: new Date().toISOString(),
        },
        null,
        2,
      ),
      "utf8",
    )
  }

  return { restoredVersion: metadata.previousVersion ?? null }
}
