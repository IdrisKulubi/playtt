import { readdir, stat } from "node:fs/promises"
import { join } from "node:path"

import type { LocalStoragePaths } from "../local-storage/paths"
import type { EdgeRepositories } from "../local-storage/repositories"
import { safeLog } from "../health/metrics"

const SEGMENT_FILE_PATTERN = /\.(ts|mp4)$/i

export async function reindexBufferSegmentsFromDisk(input: {
  repositories: EdgeRepositories
  paths: LocalStoragePaths
  sourceIds: string[]
  segmentSeconds?: number
}): Promise<number> {
  const segmentSeconds = input.segmentSeconds ?? 4
  let indexed = 0

  for (const sourceId of input.sourceIds) {
    const existing = input.repositories.listBufferSegmentsForWindow(
      sourceId,
      new Date(0).toISOString(),
      new Date().toISOString(),
    )

    if (existing.length > 0) {
      continue
    }

    const bufferDir = input.paths.bufferForCamera(sourceId)
    let files: string[] = []

    try {
      files = await readdir(bufferDir)
    } catch {
      continue
    }

    for (const file of files) {
      if (!SEGMENT_FILE_PATTERN.test(file)) {
        continue
      }

      const path = join(bufferDir, file)

      try {
        const fileStat = await stat(path)
        if (fileStat.size < 100) {
          continue
        }

        const endedAt = new Date(fileStat.mtimeMs)
        const startedAt = new Date(
          endedAt.getTime() - segmentSeconds * 1000,
        )

        input.repositories.recordBufferSegment({
          id: `${sourceId}-${file}`,
          cameraId: sourceId,
          path,
          startedAt: startedAt.toISOString(),
          endedAt: endedAt.toISOString(),
          durationSeconds: segmentSeconds,
        })
        indexed += 1
      } catch {
        // File may be incomplete.
      }
    }

    if (indexed > 0) {
      safeLog("info", "Reindexed buffer segments from disk", {
        sourceId,
        segmentCount: indexed,
      })
    }
  }

  return indexed
}
