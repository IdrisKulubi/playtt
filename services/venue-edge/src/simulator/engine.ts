import { mkdir, writeFile } from "node:fs/promises"
import { join } from "node:path"

import type { CaptureReplayPayload } from "../cloud/client"
import type { EdgeRepositories } from "../local-storage/repositories"
import type { LocalStoragePaths } from "../local-storage/paths"
import { createMinimalMp4Fixture } from "./fixtures"

export interface SimulatorStep {
  status: string
  at: string
}

export async function runDeterministicSimulatorCapture(input: {
  payload: CaptureReplayPayload
  paths: LocalStoragePaths
  repositories: EdgeRepositories
}): Promise<{ clipPath: string; steps: SimulatorStep[] }> {
  const steps: SimulatorStep[] = []
  const record = (status: string) => {
    steps.push({ status, at: new Date().toISOString() })
  }

  record("edge_acknowledged")
  record("capturing")
  record("extracting")

  const clipDir = input.paths.pendingForReplay(input.payload.replayRequestId)
  await mkdir(clipDir, { recursive: true })

  const clipPath = join(clipDir, "clip.mp4")
  const fixture = createMinimalMp4Fixture(input.payload.replayRequestId)
  await writeFile(clipPath, fixture)

  input.repositories.updateReplayJob(input.payload.replayRequestId, {
    status: "extracting",
    localClipPath: clipPath,
  })

  record("uploading")
  record("verifying")
  record("ready")

  return { clipPath, steps }
}
