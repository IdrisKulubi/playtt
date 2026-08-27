import { randomUUID } from "node:crypto"

import type { EdgeConfigV2, ReplayCaptureMode } from "../cloud/config-v2"
import type { EdgeRepositories } from "../local-storage/repositories"
import type {
  AuthorizedResourceView,
  LocalResourceCandidateView,
  LocalResourcePolicyView,
  MappingWarning,
} from "../local-storage/local-camera-types"

export class LocalResourceMappingError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = "LocalResourceMappingError"
  }
}

const VALID_CAPTURE_MODES = new Set<ReplayCaptureMode>([
  "edge_buffer",
  "nvr_playback",
])

function isUnhealthy(status: string | null | undefined): boolean {
  return status === "unhealthy" || status === "degraded"
}

export class LocalResourceMappingManager {
  constructor(
    private readonly repositories: EdgeRepositories,
    private readonly getEdgeConfigV2: () => EdgeConfigV2 | null,
  ) {}

  listAuthorizedResources(): {
    resources: AuthorizedResourceView[]
    needsConfig: boolean
  } {
    const config = this.getEdgeConfigV2()
    if (!config) {
      return {
        resources: [],
        needsConfig: true,
      }
    }

    return {
      resources: config.resources.map((resource) => ({
        id: resource.resourceId,
        label: resource.label,
        enabled: resource.enabled,
      })),
      needsConfig: false,
    }
  }

  getResourcePolicy(resourceId: string): LocalResourcePolicyView | null {
    const config = this.getEdgeConfigV2()
    const authorized = config?.resources.find(
      (entry) => entry.resourceId === resourceId,
    )

    if (!authorized) {
      return null
    }

    const policy = this.repositories.getLocalResourcePolicy(resourceId)
    const routes = this.repositories.listLocalResourceRoutes(resourceId)
    const warnings = this.buildWarnings(resourceId, routes, config)

    return this.buildPolicyView(
      authorized.resourceId,
      authorized.label,
      policy,
      routes,
      warnings,
    )
  }

  putResourcePolicy(
    resourceId: string,
    input: {
      selectionMode?: unknown
      manualSourceId?: unknown | null
      failureThreshold?: unknown
      cooldownSeconds?: unknown
      healthyThreshold?: unknown
      autoFailback?: unknown
      candidates?: unknown
    },
  ): LocalResourcePolicyView {
    const config = this.getEdgeConfigV2()
    const authorized = config?.resources.find(
      (entry) => entry.resourceId === resourceId,
    )

    if (!authorized) {
      throw new LocalResourceMappingError(
        "unknown_resource",
        "Resource is not in the authorized Config v2 resource list.",
      )
    }

    const existing = this.repositories.getLocalResourcePolicy(resourceId)
    const selectionMode =
      input.selectionMode === "manual" || input.selectionMode === "automatic"
        ? input.selectionMode
        : existing?.selectionMode ?? "automatic"

    const manualSourceId =
      input.manualSourceId === null || input.manualSourceId === undefined
        ? existing?.manualSourceId ?? null
        : typeof input.manualSourceId === "string"
          ? input.manualSourceId
          : null

    const failureThreshold = parsePositiveInt(
      input.failureThreshold,
      existing?.failureThreshold ?? 3,
      "failureThreshold",
    )
    const cooldownSeconds = parsePositiveInt(
      input.cooldownSeconds,
      existing?.cooldownSeconds ?? 60,
      "cooldownSeconds",
    )
    const healthyThreshold = parsePositiveInt(
      input.healthyThreshold,
      existing?.healthyThreshold ?? 2,
      "healthyThreshold",
    )
    const autoFailback =
      input.autoFailback === undefined
        ? existing?.autoFailback ?? true
        : Boolean(input.autoFailback)

    const parsedCandidates =
      input.candidates === undefined
        ? this.repositories.listLocalResourceRoutes(resourceId).map((route) => ({
            cameraId: route.cameraId,
            priority: route.priority,
            captureModes: route.captureModes,
            enabled: route.enabled,
          }))
        : this.parseCandidates(input.candidates)
    const cameraIds = new Set<string>()
    for (const candidate of parsedCandidates) {
      if (cameraIds.has(candidate.cameraId)) {
        throw new LocalResourceMappingError(
          "duplicate_camera",
          "Each camera can appear only once per resource.",
        )
      }
      cameraIds.add(candidate.cameraId)

      const camera = this.repositories.getLocalCameraById(candidate.cameraId)
      if (!camera) {
        throw new LocalResourceMappingError(
          "missing_camera",
          `Camera ${candidate.cameraId} was not found.`,
        )
      }

      if (!camera.enabled) {
        throw new LocalResourceMappingError(
          "camera_disabled",
          `Camera ${camera.label} must be enabled for capture before mapping.`,
        )
      }
    }

    this.repositories.upsertLocalResourcePolicy({
      resourceId,
      label: authorized.label,
      selectionMode,
      manualSourceId,
      failureThreshold,
      cooldownSeconds,
      healthyThreshold,
      autoFailback,
    })

    const routes = this.repositories.replaceLocalResourceRoutes(
      resourceId,
      parsedCandidates.map((candidate) => ({
        id: randomUUID(),
        cameraId: candidate.cameraId,
        priority: candidate.priority,
        captureModes: candidate.captureModes,
        enabled: candidate.enabled,
      })),
    )
    this.repositories.invalidateCommissioning()

    const warnings = this.buildWarnings(resourceId, routes, config)

    const policy = this.repositories.getLocalResourcePolicy(resourceId)
    return this.buildPolicyView(
      authorized.resourceId,
      authorized.label,
      policy,
      routes,
      warnings,
    )
  }

  private buildPolicyView(
    resourceId: string,
    label: string,
    policy: ReturnType<EdgeRepositories["getLocalResourcePolicy"]>,
    routes: ReturnType<EdgeRepositories["listLocalResourceRoutes"]>,
    warnings: MappingWarning[],
  ): LocalResourcePolicyView {
    const candidates: LocalResourceCandidateView[] = routes.map((route) => {
      const camera = this.repositories.getLocalCameraById(route.cameraId)
      const nvr = camera
        ? this.repositories.getLocalNvrById(camera.nvrId)
        : null

      return {
        cameraId: route.cameraId,
        priority: route.priority,
        captureModes: route.captureModes,
        enabled: route.enabled,
        cameraLabel: camera?.label ?? null,
        nvrLabel: nvr?.label ?? null,
        channelKey: camera?.channelKey ?? null,
      }
    })

    return {
      resourceId,
      label,
      selectionMode: policy?.selectionMode ?? "automatic",
      manualSourceId: policy?.manualSourceId ?? null,
      failover: {
        failureThreshold: policy?.failureThreshold ?? 3,
        cooldownSeconds: policy?.cooldownSeconds ?? 60,
        healthyThreshold: policy?.healthyThreshold ?? 2,
        autoFailback: policy?.autoFailback ?? true,
      },
      candidates,
      warnings,
    }
  }

  private buildWarnings(
    resourceId: string,
    routes: ReturnType<EdgeRepositories["listLocalResourceRoutes"]>,
    config: EdgeConfigV2 | null,
  ): MappingWarning[] {
    const warnings: MappingWarning[] = []

    if (!config?.resources.some((entry) => entry.resourceId === resourceId)) {
      warnings.push({
        code: "unknown_resource",
        message:
          "Resource is not in the last-known-good Config v2 resource list.",
      })
    }

    for (const route of routes) {
      const camera = this.repositories.getLocalCameraById(route.cameraId)
      if (!camera) {
        warnings.push({
          code: "missing_camera",
          message: `Mapped camera ${route.cameraId} is missing from local inventory.`,
        })
        continue
      }

      if (!camera.enabled) {
        warnings.push({
          code: "camera_disabled",
          message: `${camera.label} is disabled for PlayTT capture.`,
        })
      }

      const health = this.repositories.getSourceHealthBySourceId(camera.id)
      if (isUnhealthy(health?.status)) {
        warnings.push({
          code: "camera_unhealthy",
          message: `${camera.label} health is ${health?.status ?? "unknown"}.`,
        })
      }

      const otherResources = this.repositories
        .listResourceIdsForCamera(camera.id)
        .filter((id) => id !== resourceId)

      if (otherResources.length > 0) {
        warnings.push({
          code: "duplicate_mapping",
          message: `${camera.label} is also mapped to resource(s): ${otherResources.join(", ")}.`,
        })
      }
    }

    return warnings
  }

  private parseCandidates(
    value: unknown,
  ): Array<{
    cameraId: string
    priority: number
    captureModes: ReplayCaptureMode[]
    enabled: boolean
  }> {
    if (value === undefined) {
      return []
    }

    if (!Array.isArray(value)) {
      throw new LocalResourceMappingError(
        "invalid_candidates",
        "Candidates must be an array.",
      )
    }

    return value.map((entry, index) => {
      if (!entry || typeof entry !== "object") {
        throw new LocalResourceMappingError(
          "invalid_candidates",
          `Candidate ${index + 1} is invalid.`,
        )
      }

      const candidate = entry as Record<string, unknown>
      const cameraId =
        typeof candidate.cameraId === "string" ? candidate.cameraId.trim() : ""
      if (!cameraId) {
        throw new LocalResourceMappingError(
          "invalid_candidates",
          `Candidate ${index + 1} is missing cameraId.`,
        )
      }

      const priority = Number(candidate.priority)
      if (!Number.isInteger(priority) || priority <= 0) {
        throw new LocalResourceMappingError(
          "invalid_candidates",
          `Candidate ${index + 1} priority must be a positive integer.`,
        )
      }

      if (!Array.isArray(candidate.captureModes)) {
        throw new LocalResourceMappingError(
          "invalid_candidates",
          `Candidate ${index + 1} captureModes must be an array.`,
        )
      }

      const captureModes = candidate.captureModes.map((mode) => {
        if (
          typeof mode !== "string" ||
          !VALID_CAPTURE_MODES.has(mode as ReplayCaptureMode)
        ) {
          throw new LocalResourceMappingError(
            "invalid_candidates",
            `Candidate ${index + 1} has invalid capture mode.`,
          )
        }
        return mode as ReplayCaptureMode
      })

      return {
        cameraId,
        priority,
        captureModes,
        enabled: candidate.enabled === undefined ? true : Boolean(candidate.enabled),
      }
    })
  }
}

function parsePositiveInt(
  value: unknown,
  fallback: number,
  field: string,
): number {
  if (value === undefined) {
    return fallback
  }

  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new LocalResourceMappingError(
      "invalid_policy",
      `${field} must be a positive integer.`,
    )
  }

  return parsed
}
