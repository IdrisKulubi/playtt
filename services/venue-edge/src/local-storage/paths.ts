import { join } from "node:path"
import type { VenueEdgeEnv } from "../config/env"

export interface LocalStoragePaths {
  root: string
  buffers: string
  pending: string
  uploaded: string
  failed: string
  commissioning: string
  bufferForCamera(cameraId: string): string
  pendingForReplay(replayRequestId: string): string
  commissioningPreviewForCamera(cameraId: string): string
}

export function createLocalStoragePaths(env: VenueEdgeEnv): LocalStoragePaths {
  const root = env.dataDir

  return {
    root,
    buffers: join(root, "buffers"),
    pending: join(root, "pending"),
    uploaded: join(root, "uploaded"),
    failed: join(root, "failed"),
    commissioning: join(root, "commissioning"),
    bufferForCamera(cameraId: string) {
      return join(root, "buffers", cameraId)
    },
    pendingForReplay(replayRequestId: string) {
      return join(root, "pending", replayRequestId)
    },
    commissioningPreviewForCamera(cameraId: string) {
      return join(root, "commissioning", cameraId, "preview.mp4")
    },
  }
}
