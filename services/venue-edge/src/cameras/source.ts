import type { EdgeConfig } from "../cloud/client"
import type { EdgeConfigV2 } from "../cloud/config-v2"
import type { VenueEdgeEnv } from "../config/env"

export interface CameraSourceConfig {
  cameraId: string
  label: string
  rtspUrl: string | null
  bufferSeconds: number
  resourceId?: string
}

export function resolveCameraSourceFromV2(
  env: VenueEdgeEnv,
  edgeConfigV2: EdgeConfigV2 | null
): CameraSourceConfig | null {
  if (!edgeConfigV2) {
    return null
  }

  for (const policy of edgeConfigV2.resourcePolicies) {
    const resource = edgeConfigV2.resources.find(
      (entry) => entry.resourceId === policy.resourceId
    )
    if (!resource?.enabled) {
      continue
    }

    const primaryCandidate =
      policy.candidates.find((candidate) => candidate.priority === 1) ??
      policy.candidates[0]

    if (!primaryCandidate) {
      continue
    }

    const source = edgeConfigV2.sources.find(
      (entry) => entry.id === primaryCandidate.sourceId
    )

    if (
      !source?.enabled ||
      !primaryCandidate.captureModes.includes("edge_buffer")
    ) {
      continue
    }

    return {
      cameraId: source.id,
      label: source.label,
      rtspUrl: env.rtspUrl,
      bufferSeconds: 120,
    }
  }

  return null
}

export function resolveCameraSource(
  env: VenueEdgeEnv,
  edgeConfig: EdgeConfig | null,
  edgeConfigV2?: EdgeConfigV2 | null
): CameraSourceConfig {
  const fromV2 = resolveCameraSourceFromV2(env, edgeConfigV2 ?? null)
  if (fromV2) {
    return fromV2
  }

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
    cameraId: typeof cameraRecord.id === "string" ? cameraRecord.id : "primary",
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
  resourceId: string
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

export function commandMatchesActiveConfig(
  edgeConfig: EdgeConfig | null,
  edgeConfigV2: EdgeConfigV2 | null,
  resourceId: string,
  configRevisionId?: string
): { accepted: boolean; reason?: string } {
  if (edgeConfigV2) {
    if (configRevisionId !== edgeConfigV2.configRevision.id) {
      return { accepted: false, reason: "stale_config" }
    }

    const resource = edgeConfigV2.resources.find(
      (entry) => entry.resourceId === resourceId
    )

    if (!resource?.enabled) {
      return { accepted: false, reason: "resource_not_configured" }
    }

    const policy = edgeConfigV2.resourcePolicies.find(
      (entry) => entry.resourceId === resourceId
    )

    if (!policy) {
      return { accepted: false, reason: "no_source_configured" }
    }

    return { accepted: true }
  }

  return commandMatchesEdgeAssignment(edgeConfig, resourceId)
}
