// After a venue has been set up and published, PlayTT admin becomes the place
// to change which camera films which table. When a newer Config v2 revision
// arrives, copy its table ↔ camera mapping into the local routes so the local
// overlay (which drives capture) follows PlayTT without re-running setup.
import { randomUUID } from "node:crypto"

import type { EdgeConfigV2 } from "../cloud/config-v2"
import type { EdgeRepositories } from "../local-storage/repositories"

export interface CloudMappingAdoptionResult {
  adopted: boolean
  reason:
    | "not_published"
    | "older_than_local_publish"
    | "no_changes"
    | "adopted"
  changedTables: string[]
  skippedTables: string[]
}

/**
 * Finds the local camera for a cloud source: same recorder (matched by its
 * local connection key) and channel, preferring the same stream profile.
 */
function resolveLocalCameraId(
  repositories: EdgeRepositories,
  config: EdgeConfigV2,
  sourceId: string,
): string | null {
  const source = config.sources.find((entry) => entry.id === sourceId)
  if (!source) return null
  const recorder = config.recorders.find((entry) => entry.id === source.recorderId)
  if (!recorder?.localConnectionKey) return null
  const nvr = repositories.getLocalNvrByConnectionKey(recorder.localConnectionKey)
  if (!nvr) return null
  const profile = source.streamProfile === "sub" ? "sub" : "main"
  const camera =
    repositories.findLocalCameraByNvrChannel(nvr.id, source.channelKey, profile) ??
    repositories.findLocalCameraByNvrChannel(nvr.id, source.channelKey, profile === "main" ? "sub" : "main")
  return camera?.id ?? null
}

export function adoptCloudTableMappings(
  repositories: EdgeRepositories,
  config: EdgeConfigV2,
): CloudMappingAdoptionResult {
  const result: CloudMappingAdoptionResult = {
    adopted: false,
    reason: "no_changes",
    changedTables: [],
    skippedTables: [],
  }

  // Before the first publish the local wizard is the source of truth; local
  // edits after a publish clear publishedAt until the operator publishes again.
  const state = repositories.getCommissioningState()
  if (!state.publishedAt) {
    return { ...result, reason: "not_published" }
  }
  if (Date.parse(config.configRevision.publishedAt) <= Date.parse(state.publishedAt)) {
    return { ...result, reason: "older_than_local_publish" }
  }

  for (const resource of config.resources) {
    const policy = config.resourcePolicies.find((entry) => entry.resourceId === resource.resourceId)
    const candidates = [...(policy?.candidates ?? [])].sort((left, right) => left.priority - right.priority)
    const mapped = candidates.map((candidate) => ({
      cameraId: resolveLocalCameraId(repositories, config, candidate.sourceId),
      priority: candidate.priority,
      captureModes: candidate.captureModes,
    }))
    if (mapped.some((entry) => !entry.cameraId)) {
      // A camera PlayTT knows that this PC doesn't; leave this table alone.
      result.skippedTables.push(resource.label)
      continue
    }

    const current = repositories
      .listLocalResourceRoutes(resource.resourceId)
      .filter((route) => route.enabled)
      .sort((left, right) => left.priority - right.priority)
    const localPolicy = repositories.getLocalResourcePolicy(resource.resourceId)
    const manualCameraId = policy?.manualSourceId
      ? resolveLocalCameraId(repositories, config, policy.manualSourceId)
      : null
    const sameRoutes =
      current.length === mapped.length &&
      current.every((route, index) => route.cameraId === mapped[index].cameraId && route.priority === mapped[index].priority)
    const samePolicy =
      !policy ||
      (localPolicy?.selectionMode === policy.selectionMode &&
        (localPolicy?.manualSourceId ?? null) === manualCameraId &&
        localPolicy?.autoFailback === policy.failover.autoFailback &&
        localPolicy?.failureThreshold === policy.failover.failureThreshold &&
        localPolicy?.cooldownSeconds === policy.failover.cooldownSeconds &&
        localPolicy?.healthyThreshold === policy.failover.healthyThreshold)
    if (sameRoutes && samePolicy) continue

    repositories.upsertLocalResourcePolicy({
      resourceId: resource.resourceId,
      label: resource.label,
      selectionMode: policy?.selectionMode ?? localPolicy?.selectionMode ?? "automatic",
      manualSourceId: manualCameraId,
      failureThreshold: policy?.failover.failureThreshold ?? localPolicy?.failureThreshold ?? 3,
      cooldownSeconds: policy?.failover.cooldownSeconds ?? localPolicy?.cooldownSeconds ?? 60,
      healthyThreshold: policy?.failover.healthyThreshold ?? localPolicy?.healthyThreshold ?? 2,
      autoFailback: policy?.failover.autoFailback ?? localPolicy?.autoFailback ?? true,
    })
    repositories.replaceLocalResourceRoutes(
      resource.resourceId,
      mapped.map((entry) => ({
        id: randomUUID(),
        cameraId: entry.cameraId as string,
        priority: entry.priority,
        captureModes: entry.captureModes,
        enabled: true,
      })),
    )
    // A camera PlayTT put on a table must record; keep its last check.
    for (const entry of mapped) {
      const camera = repositories.getLocalCameraById(entry.cameraId as string)
      if (camera && !camera.enabled) {
        repositories.updateLocalCamera(camera.id, { enabled: true })
      }
    }
    result.changedTables.push(resource.label)
  }

  if (result.changedTables.length > 0) {
    return { ...result, adopted: true, reason: "adopted" }
  }
  return result
}
