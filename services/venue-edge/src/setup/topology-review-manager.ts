import { createHash } from "node:crypto"

import type { EdgeRepositories } from "../local-storage/repositories"
import type { LocalCameraManager } from "./local-camera-manager"
import type { LocalNvrManager } from "./local-nvr-manager"

export interface TopologyReviewIssue {
  code: "duplicate_nvr_endpoint" | "suspicious_camera"
  severity: "warning" | "blocking"
  message: string
  nvrIds: string[]
  cameraIds: string[]
}

export interface TopologyCleanupProposal {
  fingerprint: string
  issues: TopologyReviewIssue[]
  deleteNvrIds: string[]
  deleteCameraIds: string[]
  renames: Array<{ nvrId: string; label: string }>
  requiresManualReview: boolean
}

export class TopologyReviewError extends Error {
  constructor(
    readonly code: "topology_changed" | "invalid_cleanup" | "cleanup_busy",
    message: string,
  ) {
    super(message)
    this.name = "TopologyReviewError"
  }
}

function canonicalFingerprint(repositories: EdgeRepositories): string {
  const payload = {
    nvrs: repositories.listLocalNvrs().map((nvr) => ({
      id: nvr.id,
      label: nvr.label,
      host: nvr.host.toLowerCase(),
      rtspPort: nvr.rtspPort,
      enabled: nvr.enabled,
      updatedAt: nvr.updatedAt,
    })),
    cameras: repositories.listLocalCameras().map((camera) => ({
      id: camera.id,
      nvrId: camera.nvrId,
      channelKey: camera.channelKey,
      streamProfile: camera.streamProfile,
      enabled: camera.enabled,
      lastTest: camera.lastTest,
      updatedAt: camera.updatedAt,
    })),
    routes: repositories.listAllLocalResourceRoutes().map((route) => ({
      id: route.id,
      resourceId: route.resourceId,
      cameraId: route.cameraId,
      priority: route.priority,
      enabled: route.enabled,
    })),
  }

  return createHash("sha256")
    .update(JSON.stringify(payload))
    .digest("hex")
}

function nvrScore(repositories: EdgeRepositories, nvrId: string): number {
  return repositories.listLocalCamerasByNvrId(nvrId).reduce((score, camera) => {
    const routeCount = repositories.listLocalResourceRoutesForCamera(camera.id).length
    return (
      score +
      1 +
      (camera.enabled ? 10 : 0) +
      (camera.lastTest?.passed ? 5 : 0) +
      routeCount * 20
    )
  }, 0)
}

export class TopologyReviewManager {
  private applying = false

  constructor(
    private readonly repositories: EdgeRepositories,
    private readonly localNvrManager: LocalNvrManager,
    private readonly localCameraManager: LocalCameraManager,
  ) {}

  buildProposal(): TopologyCleanupProposal {
    const issues: TopologyReviewIssue[] = []
    const deleteNvrIds = new Set<string>()
    const deleteCameraIds = new Set<string>()
    const renames: Array<{ nvrId: string; label: string }> = []
    let requiresManualReview = false

    const endpointGroups = new Map<string, ReturnType<EdgeRepositories["listLocalNvrs"]>>()
    for (const nvr of this.repositories.listLocalNvrs()) {
      const key = `${nvr.host.trim().toLowerCase()}:${nvr.rtspPort}`
      endpointGroups.set(key, [...(endpointGroups.get(key) ?? []), nvr])
    }

    for (const group of endpointGroups.values()) {
      if (group.length < 2) continue

      const ranked = [...group].sort(
        (left, right) =>
          nvrScore(this.repositories, right.id) -
            nvrScore(this.repositories, left.id) ||
          left.createdAt.localeCompare(right.createdAt),
      )
      const keeper = ranked[0]
      const removable = ranked.slice(1).filter(
        (nvr) => this.repositories.listLocalCamerasByNvrId(nvr.id).length === 0,
      )
      const nonEmptyDuplicates = ranked.slice(1).filter(
        (nvr) => this.repositories.listLocalCamerasByNvrId(nvr.id).length > 0,
      )

      removable.forEach((nvr) => deleteNvrIds.add(nvr.id))
      if (nonEmptyDuplicates.length > 0) requiresManualReview = true

      const preferredLabel = removable.find(
        (nvr) => !/^test(?:\s|$)/i.test(nvr.label),
      )?.label
      if (preferredLabel && /^test(?:\s|$)/i.test(keeper.label)) {
        renames.push({ nvrId: keeper.id, label: preferredLabel })
      }

      issues.push({
        code: "duplicate_nvr_endpoint",
        severity: nonEmptyDuplicates.length > 0 ? "blocking" : "warning",
        message:
          nonEmptyDuplicates.length > 0
            ? `${group.length} recorder records share ${keeper.host}:${keeper.rtspPort}. Choose which camera inventory to keep.`
            : `${group.length} recorder records share ${keeper.host}:${keeper.rtspPort}. The empty duplicate can be removed safely.`,
        nvrIds: group.map((nvr) => nvr.id),
        cameraIds: [],
      })
    }

    for (const camera of this.repositories.listLocalCameras()) {
      if (camera.lastTest?.passed !== false) continue
      const routed = this.repositories.listLocalResourceRoutesForCamera(camera.id)
      const safeToPreselect = !camera.enabled && routed.length === 0
      if (safeToPreselect) deleteCameraIds.add(camera.id)
      else requiresManualReview = true
      issues.push({
        code: "suspicious_camera",
        severity: safeToPreselect ? "warning" : "blocking",
        message: safeToPreselect
          ? `${camera.label} did not return valid video and is not enabled or mapped.`
          : `${camera.label} did not return valid video but is enabled or mapped. Review it before removal.`,
        nvrIds: [camera.nvrId],
        cameraIds: [camera.id],
      })
    }

    return {
      fingerprint: canonicalFingerprint(this.repositories),
      issues,
      deleteNvrIds: [...deleteNvrIds],
      deleteCameraIds: [...deleteCameraIds],
      renames,
      requiresManualReview,
    }
  }

  async apply(input: {
    fingerprint: string
    deleteNvrIds: string[]
    deleteCameraIds: string[]
    renames?: Array<{ nvrId: string; label: string }>
  }): Promise<TopologyCleanupProposal> {
    if (this.applying) {
      throw new TopologyReviewError("cleanup_busy", "Another cleanup is already running.")
    }
    if (input.fingerprint !== canonicalFingerprint(this.repositories)) {
      throw new TopologyReviewError(
        "topology_changed",
        "The topology changed after this review. Refresh the proposal before applying it.",
      )
    }

    const proposal = this.buildProposal()
    const allowedNvrIds = new Set(proposal.deleteNvrIds)
    const allowedCameraIds = new Set(
      proposal.issues.flatMap((issue) => issue.cameraIds),
    )
    const allowedRenames = new Map(
      proposal.renames.map((rename) => [rename.nvrId, rename.label]),
    )
    if (
      input.deleteNvrIds.some((id) => !allowedNvrIds.has(id)) ||
      input.deleteCameraIds.some((id) => !allowedCameraIds.has(id)) ||
      (input.renames ?? []).some(
        (rename) => allowedRenames.get(rename.nvrId) !== rename.label.trim(),
      )
    ) {
      throw new TopologyReviewError(
        "invalid_cleanup",
        "The cleanup contains records that were not part of this review.",
      )
    }

    this.applying = true
    try {
      for (const cameraId of input.deleteCameraIds) {
        await this.localCameraManager.deleteCamera(cameraId)
      }
      for (const nvrId of input.deleteNvrIds) {
        await this.localNvrManager.deleteNvr(nvrId)
      }
      for (const rename of input.renames ?? []) {
        if (!rename.label.trim()) continue
        await this.localNvrManager.updateNvr(rename.nvrId, {
          label: rename.label.trim(),
        })
      }
      return this.buildProposal()
    } finally {
      this.applying = false
    }
  }
}
