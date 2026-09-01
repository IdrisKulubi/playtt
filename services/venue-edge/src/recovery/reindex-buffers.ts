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
    const bufferDir = input.paths.bufferForCamera(sourceId)
    let files: string[] = []
    let sourceIndexed = 0

    try {
      files = await readdir(bufferDir)
    } catch {
      continue
    }

    const closedSegmentFiles = files
      .filter((file) => SEGMENT_FILE_PATTERN.test(file))
      .sort()
      .slice(0, -1)

    for (const file of closedSegmentFiles) {

      const path = join(bufferDir, file)

      try {
        const fileStat = await stat(path)
        if (fileStat.size < 100) {
          continue
        }

        const endedAtMs = fileStat.mtimeMs
        const birthtimeLooksUsable =
          Number.isFinite(fileStat.birthtimeMs) &&
          fileStat.birthtimeMs > 0 &&
          fileStat.birthtimeMs < endedAtMs - 250
        const startedAtMs = birthtimeLooksUsable
          ? fileStat.birthtimeMs
          : endedAtMs - segmentSeconds * 1000
        const endedAt = new Date(endedAtMs)
        const startedAt = new Date(startedAtMs)
        const measuredDurationSeconds = Math.max(
          0.1,
          (endedAtMs - startedAtMs) / 1000,
        )

        input.repositories.recordBufferSegment({
          id: `${sourceId}-${file}`,
          cameraId: sourceId,
          path,
          startedAt: startedAt.toISOString(),
          endedAt: endedAt.toISOString(),
          durationSeconds: measuredDurationSeconds,
        })
        indexed += 1
        sourceIndexed += 1
      } catch {
        // File may be incomplete.
      }
    }

    if (sourceIndexed > 0) {
      safeLog("info", "Reindexed buffer segments from disk", {
        sourceId,
        segmentCount: sourceIndexed,
      })
    }
  }

  return indexed
}
