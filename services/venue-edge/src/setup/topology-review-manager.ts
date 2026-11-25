import { createHash } from "node:crypto"

import type { EdgeRepositories } from "../local-storage/repositories"
import type { LocalCameraManager } from "./local-camera-manager"
import type { LocalNvrManager } from "./local-nvr-manager"

export interface TopologyReviewIssue {
  code:
    | "duplicate_nvr_endpoint"
    | "suspicious_camera"
    | "duplicate_channel"
    | "possible_duplicate_recorder"
  /** "notice" issues are shown to the operator but do not block setup. */
  severity: "notice" | "warning" | "blocking"
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
            ? `The recorder at ${keeper.host} is saved ${group.length} times. Remove the copies you don't use in Add NVR.`
            : `The recorder at ${keeper.host} is saved ${group.length} times. The empty copy can be removed.`,
        nvrIds: group.map((nvr) => nvr.id),
        cameraIds: [],
      })
    }

    const inUse = (cameraId: string, enabled: boolean) =>
      enabled || this.repositories.listLocalResourceRoutesForCamera(cameraId).length > 0

    // One physical channel saved twice (main and sub stream records).
    const channelGroups = new Map<string, ReturnType<EdgeRepositories["listLocalCameras"]>>()
    for (const camera of this.repositories.listLocalCameras()) {
      const key = `${camera.nvrId}:${camera.channelKey}`
      channelGroups.set(key, [...(channelGroups.get(key) ?? []), camera])
    }
    for (const group of channelGroups.values()) {
      if (group.length < 2) continue
      const used = group.filter((camera) => inUse(camera.id, camera.enabled))
      const unused = group.filter((camera) => !inUse(camera.id, camera.enabled))
      // Keep the record that is in use; with none in use, keep the main stream.
      const removable =
        used.length > 0
          ? unused
          : group.filter((camera) => camera !== (group.find((c) => c.streamProfile === "main") ?? group[0]))
      removable.forEach((camera) => deleteCameraIds.add(camera.id))
      if (used.length > 1) requiresManualReview = true
      const nvrLabel = this.repositories.getLocalNvrById(group[0].nvrId)?.label ?? "The recorder"
      issues.push({
        code: "duplicate_channel",
        severity: used.length > 1 ? "blocking" : "warning",
        message:
          used.length > 1
            ? `${nvrLabel} channel ${group[0].channelKey} is saved twice and both copies are in use. Turn one off, then review again.`
            : `${nvrLabel} channel ${group[0].channelKey} is saved twice. The unused copy can be removed.`,
        nvrIds: [group[0].nvrId],
        cameraIds: group.map((camera) => camera.id),
      })
    }

    // The same recorder saved under two addresses (for example after its IP
    // address changed). We cannot prove it is the same box, so only point it out.
    const nvrsWithCameras = this.repositories
      .listLocalNvrs()
      .filter((nvr) => this.repositories.listLocalCamerasByNvrId(nvr.id).length > 0)
    const distinctEndpoints = new Set(
      nvrsWithCameras.map((nvr) => `${nvr.host.trim().toLowerCase()}:${nvr.rtspPort}`),
    )
    if (nvrsWithCameras.length > 1 && distinctEndpoints.size > 1) {
      const sameLogin = nvrsWithCameras.filter(
        (nvr) =>
          nvr.vendor === nvrsWithCameras[0].vendor &&
          nvr.username === nvrsWithCameras[0].username,
      )
      if (sameLogin.length > 1) {
        issues.push({
          code: "possible_duplicate_recorder",
          severity: "notice",
          message: `${sameLogin.length} recorders are saved (${sameLogin
            .map((nvr) => `${nvr.label} at ${nvr.host}`)
            .join(", ")}). If they are the same NVR, remove the old one so each camera is listed once.`,
          nvrIds: sameLogin.map((nvr) => nvr.id),
          cameraIds: [],
        })
      }
    }

    for (const camera of this.repositories.listLocalCameras()) {
      if (camera.lastTest?.passed !== false) continue
      if (deleteCameraIds.has(camera.id)) continue
      const routed = this.repositories.listLocalResourceRoutesForCamera(camera.id)
      const safeToPreselect = !camera.enabled && routed.length === 0
      if (safeToPreselect) deleteCameraIds.add(camera.id)
      else requiresManualReview = true
      issues.push({
        code: "suspicious_camera",
        severity: safeToPreselect ? "warning" : "blocking",
        message: safeToPreselect
          ? `${camera.label} isn't sending video and isn't used, so it can be removed.`
          : `${camera.label} isn't sending video. Check it's powered and shows a picture on the recorder, then check it again — or untick it if no table needs it.`,
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
