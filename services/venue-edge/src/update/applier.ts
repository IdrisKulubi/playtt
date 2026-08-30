import { mkdir, readFile, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"

import { resolveInstallRoot } from "../config/install-layout"
import {
  backupInstallTree,
  overlayReleaseTree,
  readInstallVersion,
  resolveReleaseDir,
  restoreInstallTree,
  writeInstallVersion,
} from "./release-tree"
import { extractZipArchive } from "./zip"

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

export async function applyStagedUpdate(
  input: ApplyUpdateInput,
): Promise<ApplyUpdateResult> {
  const installRoot = resolveInstallRoot()
  if (!installRoot) {
    throw new Error("UPDATE_APPLY_NOT_INSTALLED_LAYOUT")
  }

  const previousRoot = join(input.dataDir, "updates", "previous")
  const backupDir = join(previousRoot, "install-tree")
  const artifactZip = join(input.stagedDir, "artifact.zip")
  const releaseDir = resolveReleaseDir(installRoot, input.version)
  const extractDir = join(input.stagedDir, "extracted")

  await mkdir(previousRoot, { recursive: true })
  await mkdir(releaseDir, { recursive: true })

  const previousVersion = await readInstallVersion(installRoot)

  await backupInstallTree(installRoot, backupDir)

  await rm(extractDir, { recursive: true, force: true })
  await mkdir(extractDir, { recursive: true })
  await extractZipArchive(artifactZip, extractDir)

  await rm(releaseDir, { recursive: true, force: true })
  await mkdir(releaseDir, { recursive: true })
  await overlayReleaseTree(extractDir, releaseDir)
  await overlayReleaseTree(releaseDir, installRoot)

  await writeInstallVersion(installRoot, input.version, {
    releasePath: `releases/${input.version}`,
    appliedAt: new Date().toISOString(),
  })

  await writeFile(
    join(previousRoot, "metadata.json"),
    JSON.stringify(
      {
        attemptId: input.attemptId,
        previousVersion,
        targetVersion: input.version,
        backedUpAt: new Date().toISOString(),
        installRoot,
        releaseDir,
      },
      null,
      2,
    ),
    "utf8",
  )

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

  const previousRoot = join(dataDir, "updates", "previous")
  const metadataPath = join(previousRoot, "metadata.json")
  const backupDir = join(previousRoot, "install-tree")
  const raw = await readFile(metadataPath, "utf8")
  const metadata = JSON.parse(raw) as { previousVersion?: string | null }

  await restoreInstallTree(backupDir, installRoot)

  if (metadata.previousVersion) {
    await writeInstallVersion(installRoot, metadata.previousVersion, {
      rolledBackAt: new Date().toISOString(),
    })
  }

  return { restoredVersion: metadata.previousVersion ?? null }
}
