import type { EdgeConfig } from "../cloud/client"
import type { VenueEdgeEnv } from "../config/env"

export interface CameraSourceConfig {
  cameraId: string
  label: string
  rtspUrl: string | null
  bufferSeconds: number
}

export function resolveCameraSource(
  env: VenueEdgeEnv,
  edgeConfig: EdgeConfig | null,
): CameraSourceConfig {
  const configCamera = edgeConfig?.config?.camera

  const cameraRecord =
    configCamera && typeof configCamera === "object"
      ? (configCamera as Record<string, unknown>)
      : {}

  const rtspUrl =
    typeof cameraRecord.rtspUrl === "string"
      ? cameraRecord.rtspUrl
      : env.rtspUrl

  return {
    cameraId:
      typeof cameraRecord.id === "string" ? cameraRecord.id : "primary",
    label:
      typeof cameraRecord.label === "string"
        ? cameraRecord.label
        : "primary-camera",
    rtspUrl,
    bufferSeconds: 120,
  }
}

export function commandMatchesEdgeAssignment(
  edgeConfig: EdgeConfig | null,
  resourceId: string,
): { accepted: boolean; reason?: string } {
  if (!edgeConfig) {
    return { accepted: false, reason: "edge_config_unavailable" }
  }

  if (edgeConfig.resourceId !== resourceId) {
    return { accepted: false, reason: "resource_mismatch" }
  }

  if (edgeConfig.role !== "venue_edge") {
    return { accepted: false, reason: "role_mismatch" }
  }

  return { accepted: true }
}
