import { cp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"

const EXCLUDED_BACKUP_NAMES = new Set([
  "updates",
  ".dpapi-entropy",
  "credentials",
  "nvrs",
])

export async function copyDirectoryTree(
  sourceDir: string,
  targetDir: string,
): Promise<void> {
  await mkdir(targetDir, { recursive: true })
  const entries = await readdir(sourceDir, { withFileTypes: true })

  for (const entry of entries) {
    const sourcePath = join(sourceDir, entry.name)
    const targetPath = join(targetDir, entry.name)

    if (entry.isDirectory()) {
      await copyDirectoryTree(sourcePath, targetPath)
      continue
    }

    if (entry.isFile()) {
      await cp(sourcePath, targetPath)
    }
  }
}

export async function backupInstallTree(
  installRoot: string,
  backupDir: string,
): Promise<void> {
  await rm(backupDir, { recursive: true, force: true })
  await mkdir(backupDir, { recursive: true })

  const entries = await readdir(installRoot, { withFileTypes: true })
  for (const entry of entries) {
    if (!entry.isDirectory() && !entry.isFile()) {
      continue
    }

    if (entry.isDirectory() && EXCLUDED_BACKUP_NAMES.has(entry.name)) {
      continue
    }

    const sourcePath = join(installRoot, entry.name)
    const targetPath = join(backupDir, entry.name)

    if (entry.isDirectory()) {
      await copyDirectoryTree(sourcePath, targetPath)
    } else {
      await cp(sourcePath, targetPath)
    }
  }
}

export async function restoreInstallTree(
  backupDir: string,
  installRoot: string,
): Promise<void> {
  const entries = await readdir(backupDir, { withFileTypes: true })

  for (const entry of entries) {
    const sourcePath = join(backupDir, entry.name)
    const targetPath = join(installRoot, entry.name)

    if (entry.isDirectory()) {
      await copyDirectoryTree(sourcePath, targetPath)
    } else {
      await cp(sourcePath, targetPath)
    }
  }
}

export async function overlayReleaseTree(
  releaseDir: string,
  installRoot: string,
): Promise<void> {
  const entries = await readdir(releaseDir, { withFileTypes: true })

  for (const entry of entries) {
    const sourcePath = join(releaseDir, entry.name)
    const targetPath = join(installRoot, entry.name)

    if (entry.isDirectory()) {
      await copyDirectoryTree(sourcePath, targetPath)
    } else {
      await cp(sourcePath, targetPath)
    }
  }
}

export async function readInstallVersion(
  installRoot: string,
): Promise<string | null> {
  try {
    const raw = await readFile(join(installRoot, "version.json"), "utf8")
    const parsed = JSON.parse(raw) as { version?: string }
    return parsed.version?.trim() || null
  } catch {
    return null
  }
}

export async function writeInstallVersion(
  installRoot: string,
  version: string,
  extra: Record<string, unknown> = {},
): Promise<void> {
  await writeFile(
    join(installRoot, "version.json"),
    JSON.stringify(
      {
        version,
        channel: "stable",
        minimumAgentVersion: "0.1.0",
        signed: true,
        ...extra,
      },
      null,
      2,
    ),
    "utf8",
  )
}

export function resolveReleaseDir(
  installRoot: string,
  version: string,
): string {
  return join(installRoot, "releases", version)
}
