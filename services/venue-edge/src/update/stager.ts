import { copyFile, mkdir, readdir, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"

export interface StageUpdateBundleInput {
  dataDir: string
  attemptId: string
  artifactPath: string
  version: string
}

export interface StagedUpdateBundle {
  attemptId: string
  version: string
  stagedDir: string
  manifestPath: string
}

export async function stageUpdateBundle(
  input: StageUpdateBundleInput,
): Promise<StagedUpdateBundle> {
  const stagedDir = join(input.dataDir, "updates", "staged", input.attemptId)
  await mkdir(stagedDir, { recursive: true })

  const stagedArtifact = join(stagedDir, "artifact.zip")
  await copyFile(input.artifactPath, stagedArtifact)

  const manifestPath = join(stagedDir, "manifest.json")
  await writeFile(
    manifestPath,
    JSON.stringify(
      {
        attemptId: input.attemptId,
        version: input.version,
        artifactPath: stagedArtifact,
        stagedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
    "utf8",
  )

  return {
    attemptId: input.attemptId,
    version: input.version,
    stagedDir,
    manifestPath,
  }
}

export async function clearStagedUpdate(
  dataDir: string,
  attemptId: string,
): Promise<void> {
  const stagedDir = join(dataDir, "updates", "staged", attemptId)
  await rm(stagedDir, { recursive: true, force: true })
}

export async function listStagedUpdates(dataDir: string): Promise<string[]> {
  const stagedRoot = join(dataDir, "updates", "staged")
  try {
    const entries = await readdir(stagedRoot, { withFileTypes: true })
    return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name)
  } catch {
    return []
  }
}
