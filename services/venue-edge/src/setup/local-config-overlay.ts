import { randomUUID } from "node:crypto"

import type { EdgeConfigV2 } from "../cloud/config-v2"
import type { EdgeRepositories } from "../local-storage/repositories"

export function buildLocalConfigOverlay(
  repositories: EdgeRepositories,
  baseConfig: EdgeConfigV2,
): EdgeConfigV2 {
  const nvrs = repositories.listLocalNvrs().filter((nvr) => nvr.enabled)
  const cameras = repositories.listLocalCameras().filter((camera) => camera.enabled)

  const recorders: EdgeConfigV2["recorders"] = nvrs.map((nvr) => ({
    id: nvr.id,
    label: nvr.label,
    vendor: "vigi",
    enabled: true,
    connection: { host: nvr.host, rtspPort: nvr.rtspPort },
    localConnectionKey: nvr.localConnectionKey,
  }))

  const sources: EdgeConfigV2["sources"] = cameras.map((camera) => ({
    id: camera.id,
    recorderId: camera.nvrId,
    label: camera.label,
    channelKey: camera.channelKey,
    streamProfile: camera.streamProfile,
    codec: camera.codec === "h265" ? "h265" : "h264",
    enabled: true,
  }))

  const resourcePolicies: EdgeConfigV2["resourcePolicies"] = []

  for (const resource of baseConfig.resources) {
    if (!resource.enabled) {
      continue
    }

    const localPolicy = repositories.getLocalResourcePolicy(resource.resourceId)
    const routes = repositories.listLocalResourceRoutes(resource.resourceId)
    const candidates = routes
      .filter((route) => route.enabled)
      .map((route) => ({
        sourceId: route.cameraId,
        priority: route.priority,
        captureModes: route.captureModes,
      }))

    resourcePolicies.push({
      resourceId: resource.resourceId,
      selectionMode: localPolicy?.selectionMode ?? "automatic",
      manualSourceId: localPolicy?.manualSourceId ?? null,
      failover: {
        failureThreshold: localPolicy?.failureThreshold ?? 3,
        cooldownSeconds: localPolicy?.cooldownSeconds ?? 60,
        healthyThreshold: localPolicy?.healthyThreshold ?? 2,
        autoFailback: localPolicy?.autoFailback ?? true,
      },
      candidates,
    })
  }

  return {
    ...baseConfig,
    recorders,
    sources,
    resourcePolicies,
  }
}

export function resolveRuntimeEdgeConfigV2(
  repositories: EdgeRepositories,
  baseConfig: EdgeConfigV2 | null,
): EdgeConfigV2 | null {
  if (!baseConfig) {
    return null
  }

  const hasLocalTopology =
    repositories.listLocalNvrs().length > 0 ||
    repositories.listLocalCameras().length > 0 ||
    repositories.listLocalResourcePolicies().length > 0

  return hasLocalTopology
    ? buildLocalConfigOverlay(repositories, baseConfig)
    : baseConfig
}

export function buildMinimalOverlayInstallation(
  baseConfig: EdgeConfigV2 | null,
): EdgeConfigV2["installation"] {
  if (baseConfig) {
    return baseConfig.installation
  }

  return {
    id: randomUUID(),
    deviceId: randomUUID(),
    tenantId: randomUUID(),
    venueId: randomUUID(),
    minimumAgentVersion: "0.1.0",
  }
}
