import type { EdgeConfig } from "../cloud/client"
import type { EdgeConfigV2 } from "../cloud/config-v2"
import type { VenueEdgeEnv } from "../config/env"
import { buildSourcePlan } from "../config/source-plan"
import { resolveCameraSource, type CameraSourceConfig } from "./source"

export function listBufferingSourceIds(edgeConfigV2: EdgeConfigV2): string[] {
  return buildSourcePlan(null, edgeConfigV2).bufferingSourceIds
}

function bufferingCandidateForResource(
  edgeConfigV2: EdgeConfigV2,
  resourceId: string
): EdgeConfigV2["resourcePolicies"][number]["candidates"][number] | null {
  const policy = edgeConfigV2.resourcePolicies.find(
    (entry) => entry.resourceId === resourceId
  )

  if (!policy) {
    return null
  }

  const resource = edgeConfigV2.resources.find(
    (entry) => entry.resourceId === resourceId
  )

  if (!resource?.enabled) {
    return null
  }

  const bufferingCandidates = policy.candidates
    .filter((candidate) => candidate.captureModes.includes("edge_buffer"))
    .sort((left, right) => left.priority - right.priority)

  return bufferingCandidates[0] ?? null
}

function cameraFromSource(
  edgeConfigV2: EdgeConfigV2,
  sourceId: string,
  rtspUrl: string | null,
  resourceId?: string
): CameraSourceConfig | null {
  const source = edgeConfigV2.sources.find((entry) => entry.id === sourceId)
  const recorder = edgeConfigV2.recorders.find(
    (entry) => entry.id === source?.recorderId
  )

  if (!source?.enabled || !recorder?.enabled) {
    return null
  }

  return {
    cameraId: source.id,
    label: source.label,
    rtspUrl,
    bufferSeconds: 120,
    resourceId,
  }
}

function resolveSourceRtspUrl(
  env: VenueEdgeEnv,
  edgeConfigV2: EdgeConfigV2,
  sourceId: string
): string | null {
  const configured = env.sourceRtspUrls[sourceId]
  if (configured) {
    return configured
  }

  const sourceIds = listBufferingSourceIds(edgeConfigV2)
  return sourceIds.length === 1 ? env.rtspUrl : null
}

export function listBufferingCameras(
  env: VenueEdgeEnv,
  edgeConfig: EdgeConfig | null,
  edgeConfigV2: EdgeConfigV2 | null
): CameraSourceConfig[] {
  if (!edgeConfigV2) {
    return [resolveCameraSource(env, edgeConfig, null)]
  }

  const sourceIds = listBufferingSourceIds(edgeConfigV2)
  return sourceIds
    .map((sourceId) => {
      const policy = edgeConfigV2.resourcePolicies.find((entry) =>
        entry.candidates.some(
          (candidate) =>
            candidate.sourceId === sourceId &&
            candidate.captureModes.includes("edge_buffer")
        )
      )

      return cameraFromSource(
        edgeConfigV2,
        sourceId,
        resolveSourceRtspUrl(env, edgeConfigV2, sourceId),
        policy?.resourceId
      )
    })
    .filter((camera): camera is CameraSourceConfig => camera !== null)
}

export function getCamera(
  env: VenueEdgeEnv,
  edgeConfig: EdgeConfig | null,
  edgeConfigV2: EdgeConfigV2 | null,
  sourceId: string
): CameraSourceConfig | null {
  if (!edgeConfigV2) {
    const camera = resolveCameraSource(env, edgeConfig, null)
    return camera.cameraId === sourceId ? camera : null
  }

  const sourceIds = listBufferingSourceIds(edgeConfigV2)
  if (!sourceIds.includes(sourceId)) {
    return null
  }

  const policy = edgeConfigV2.resourcePolicies.find((entry) =>
    entry.candidates.some(
      (candidate) =>
        candidate.sourceId === sourceId &&
        candidate.captureModes.includes("edge_buffer")
    )
  )

  return cameraFromSource(
    edgeConfigV2,
    sourceId,
    resolveSourceRtspUrl(env, edgeConfigV2, sourceId),
    policy?.resourceId
  )
}

export function getCameraForCapture(
  env: VenueEdgeEnv,
  edgeConfigV2: EdgeConfigV2,
  sourceId: string,
  resourceId: string
): CameraSourceConfig | null {
  return cameraFromSource(
    edgeConfigV2,
    sourceId,
    resolveSourceRtspUrl(env, edgeConfigV2, sourceId),
    resourceId
  )
}

export function getCameraForResource(
  env: VenueEdgeEnv,
  edgeConfig: EdgeConfig | null,
  edgeConfigV2: EdgeConfigV2 | null,
  resourceId: string
): CameraSourceConfig {
  if (edgeConfigV2) {
    const candidate = bufferingCandidateForResource(edgeConfigV2, resourceId)

    if (candidate) {
      const camera = cameraFromSource(
        edgeConfigV2,
        candidate.sourceId,
        resolveSourceRtspUrl(env, edgeConfigV2, candidate.sourceId),
        resourceId
      )

      if (camera) {
        return camera
      }
    }
  }

  return resolveCameraSource(env, edgeConfig, edgeConfigV2)
}
