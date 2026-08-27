import { rm, stat } from "node:fs/promises"
import { join } from "node:path"

import type { VenueEdgeEnv } from "../config/env"
import type { LocalStoragePaths } from "../local-storage/paths"
import type { EdgeRepositories } from "../local-storage/repositories"
import { safeLog } from "../health/metrics"

async function directoryBytes(dir: string): Promise<number> {
  let total = 0

  try {
    const { readdir } = await import("node:fs/promises")
    const entries = await readdir(dir, { withFileTypes: true })

    for (const entry of entries) {
      const path = join(dir, entry.name)

      if (entry.isDirectory()) {
        total += await directoryBytes(path)
        continue
      }

      if (entry.isFile()) {
        const fileStat = await stat(path)
        total += fileStat.size
      }
    }
  } catch {
    return 0
  }

  return total
}

export async function pruneReplayWorkspace(
  paths: LocalStoragePaths,
  replayRequestId: string,
  options: { keepClipPath?: string | null } = {},
): Promise<void> {
  const replayDir = paths.pendingForReplay(replayRequestId)

  try {
    if (options.keepClipPath) {
      const { readdir } = await import("node:fs/promises")
      const entries = await readdir(replayDir)

      for (const entry of entries) {
        const path = join(replayDir, entry)
        if (path === options.keepClipPath) {
          continue
        }

        await rm(path, { force: true, recursive: true })
      }
      return
    }

    await rm(replayDir, { force: true, recursive: true })
  } catch {
    // Directory may already be gone.
  }
}

export async function measureWorkspaceBytes(
  paths: LocalStoragePaths,
): Promise<number> {
  const pending = await directoryBytes(paths.pending)
  const failed = await directoryBytes(paths.failed)
  return pending + failed
}

export async function enforceWorkspaceDiskBudget(input: {
  env: VenueEdgeEnv
  paths: LocalStoragePaths
  repositories: EdgeRepositories
  maxWorkspaceBytes?: number
}): Promise<void> {
  const maxBytes =
    input.maxWorkspaceBytes ??
    Math.max(input.env.reservedFreeDiskBytes, 8 * 1024 * 1024)

  let total = await measureWorkspaceBytes(input.paths)

  if (total <= maxBytes) {
    return
  }

  const unfinished = input.repositories.listUnfinishedReplayJobs()
  const protectedIds = new Set(
    unfinished.map((job) => job.replayRequestId),
  )

  const { readdir } = await import("node:fs/promises")
  let pendingDirs: string[] = []

  try {
    pendingDirs = await readdir(input.paths.pending)
  } catch {
    return
  }

  const candidates = pendingDirs
    .filter((id) => !protectedIds.has(id))
    .map((id) => ({
      id,
      path: join(input.paths.pending, id),
    }))

  const sized = await Promise.all(
    candidates.map(async (entry) => ({
      ...entry,
      bytes: await directoryBytes(entry.path),
      mtimeMs: (await stat(entry.path)).mtimeMs,
    })),
  )

  sized.sort((left, right) => left.mtimeMs - right.mtimeMs)

  for (const entry of sized) {
    if (total <= maxBytes) {
      break
    }

    await rm(entry.path, { force: true, recursive: true })
    total -= entry.bytes

    safeLog("info", "Pruned stale replay workspace", {
      replayRequestId: entry.id,
      bytes: entry.bytes,
    })
  }
}
