import { createHash } from "node:crypto"
import { existsSync, mkdirSync } from "node:fs"
import { dirname } from "node:path"

import type { EdgeConfigV2 } from "../cloud/config-v2"
import { EdgeProtocolError, type EdgeV1Client } from "../cloud/client"
import type { NvrPasswordStore } from "../auth/nvr-secret-store"
import type { CredentialManager } from "../auth/credential-manager"
import type { EdgeRepositories } from "../local-storage/repositories"
import type {
  CommissioningChecklist,
  CommissioningDrillResult,
  CommissioningStateRow,
} from "../local-storage/commissioning-types"
import type { LocalCameraTestSummary } from "../local-storage/local-camera-types"
import type { LocalStoragePaths } from "../local-storage/paths"
import type { SourceHealthStatus } from "../health/types"
import { LiveRtspClipAdapter } from "../video-adapters/live-rtsp-adapter"
import { buildVigiLiveRtspUrl } from "../video-adapters/vigi-urls"
import {
  DefaultNvrProbeRunner,
  type NvrProbeRunner,
  type NvrProbeSuiteResult,
} from "./nvr-probe"
import type { LocalCameraManager } from "./local-camera-manager"
import { buildLocalConfigOverlay } from "./local-config-overlay"
import {
  selectCapturePlan,
  type SourceHealthLookup,
} from "../selection/select-source"

const SECRET_KEY_PATTERN =
  /(?:password|passwd|secret|token|credential|authorization|api[_-]?key|private[_-]?key)/i

const PREVIEW_DURATION_SECONDS = 15

export interface PreviewClipRunner {
  extractClip(input: {
    rtspUrl: string
    outputPath: string
    preRollSeconds: number
    postRollSeconds: number
  }): Promise<void>
}

class DefaultPreviewClipRunner implements PreviewClipRunner {
  async extractClip(input: {
    rtspUrl: string
    outputPath: string
    preRollSeconds: number
    postRollSeconds: number
  }): Promise<void> {
    const adapter = new LiveRtspClipAdapter(input.rtspUrl)
    await adapter.extractClip({
      replayRequestId: "commissioning-preview",
      captureAt: new Date().toISOString(),
      preRollSeconds: input.preRollSeconds,
      postRollSeconds: input.postRollSeconds,
      outputPath: input.outputPath,
    })
  }
}

export class CommissioningError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = "CommissioningError"
  }
}

function rethrowAsCommissioningError(error: unknown, fallbackCode: string): never {
  if (error instanceof CommissioningError) {
    throw error
  }
  if (error instanceof EdgeProtocolError) {
    throw new CommissioningError(
      error.code.toLowerCase(),
      error.message,
    )
  }
  throw new CommissioningError(
    fallbackCode,
    error instanceof Error ? error.message : "Commissioning request failed.",
  )
}

function nonemptyOrNull(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null
  }
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function scanForSecrets(value: unknown, path = "$"): void {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => scanForSecrets(entry, `${path}[${index}]`))
    return
  }

  if (!value || typeof value !== "object") {
    return
  }

  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (SECRET_KEY_PATTERN.test(key)) {
      throw new CommissioningError(
        "forbidden_secret_field",
        `Commissioning payload contains forbidden secret field ${path}.${key}.`,
      )
    }
    scanForSecrets(nested, `${path}.${key}`)
  }
}

function toTestSummary(result: NvrProbeSuiteResult): LocalCameraTestSummary {
  return {
    passed: result.passed,
    testedAt: new Date().toISOString(),
    checks: result.checks,
  }
}

export class CommissioningManager {
  private readonly probeRunner: NvrProbeRunner
  private readonly previewClipRunner: PreviewClipRunner

  constructor(
    private readonly repositories: EdgeRepositories,
    private readonly passwordStore: NvrPasswordStore,
    private readonly localCameraManager: LocalCameraManager,
    private readonly paths: LocalStoragePaths,
    private readonly credentialManager: CredentialManager,
    private readonly getEdgeConfigV2: () => EdgeConfigV2 | null,
    private readonly client?: EdgeV1Client,
    probeRunner?: NvrProbeRunner,
    previewClipRunner?: PreviewClipRunner,
  ) {
    this.probeRunner = probeRunner ?? new DefaultNvrProbeRunner()
    this.previewClipRunner = previewClipRunner ?? new DefaultPreviewClipRunner()
  }

  getState(): CommissioningStateRow {
    return this.repositories.getCommissioningState()
  }

  async isProductionCaptureAllowed(): Promise<boolean> {
    return this.repositories.getCommissioningState().completed
  }

  buildChecklist(enrolled: boolean): CommissioningChecklist {
    const state = this.repositories.getCommissioningState()
    const enabledCameras = this.repositories
      .listLocalCameras()
      .filter((camera) => camera.enabled)

    const allEnabledCamerasTested =
      enabledCameras.length > 0 &&
      enabledCameras.every(
        (camera) =>
          camera.lastTest?.passed === true &&
          Date.parse(camera.lastTest.testedAt) >= Date.parse(camera.updatedAt),
      )

    const allEnabledCamerasPreviewed =
      enabledCameras.length > 0 &&
      enabledCameras.every((camera) => {
        const previewPath = this.paths.commissioningPreviewForCamera(camera.id)
        return existsSync(previewPath)
      })

    this.updateFailoverReadyFlag()

    const blockingReasons: string[] = []

    if (enabledCameras.length === 0) {
      blockingReasons.push("Enable at least one camera for capture.")
    }
    if (!allEnabledCamerasTested) {
      blockingReasons.push("Run tests on every enabled camera.")
    }
    const recommendedReasons: string[] = []
    if (!allEnabledCamerasPreviewed) {
      blockingReasons.push(
        "Capture a 15-second preview for every enabled camera.",
      )
    }
    if (!state.failoverReady) {
      blockingReasons.push("Complete failover drills for mapped resources.")
    }

    const baseConfig = this.getEdgeConfigV2()
    const configApplied = Boolean(
      baseConfig &&
        state.publishedAt &&
        Date.parse(baseConfig.configRevision.publishedAt) >= Date.parse(state.publishedAt),
    )
    if (baseConfig) {
      for (const resource of baseConfig.resources.filter((r) => r.enabled)) {
        const routes = this.repositories.listLocalResourceRoutes(
          resource.resourceId,
        )
        if (routes.length === 0) {
          blockingReasons.push(`Map cameras to ${resource.label}.`)
        }
      }
    }

    if (!enrolled) {
      blockingReasons.push("Pair VenueEdge with PlayTT before commissioning.")
    } else if (!state.publishedAt) {
      blockingReasons.push("Publish commissioning snapshot to PlayTT.")
    } else if (!configApplied) {
      blockingReasons.push(
        state.completed
          ? "Finishing commissioning after the latest cloud configuration applies. Keep VenueEdge online."
          : "Wait for the published cloud configuration to apply locally.",
      )
    }

    const canComplete =
      blockingReasons.length === 0 && !state.completed
    const completed = state.completed && configApplied

    return {
      enrolled,
      enabledCameraCount: enabledCameras.length,
      allEnabledCamerasTested,
      allEnabledCamerasPreviewed,
      failoverReady: state.failoverReady,
      published: Boolean(state.publishedAt),
      configApplied,
      completed,
      canComplete,
      blockingReasons,
      recommendedReasons,
    }
  }

  async testCamera(cameraId: string): Promise<{
    cameraId: string
    passed: boolean
    result: NvrProbeSuiteResult
  } | null> {
    const camera = this.repositories.getLocalCameraById(cameraId)
    if (!camera) {
      return null
    }

    const nvr = this.repositories.getLocalNvrById(camera.nvrId)
    if (!nvr) {
      throw new CommissioningError("nvr_not_found", "Camera NVR was not found.")
    }

    const password = await this.passwordStore.get(nvr.localConnectionKey)
    if (!password) {
      const summary: LocalCameraTestSummary = {
        passed: false,
        testedAt: new Date().toISOString(),
        checks: [
          {
            check: "authentication",
            passed: false,
            code: "missing_password",
            message: "No protected password is stored for this NVR.",
          },
        ],
      }
      this.repositories.updateLocalCamera(cameraId, { lastTest: summary })
      return {
        cameraId,
        passed: false,
        result: { passed: false, timeMode: nvr.timeMode, checks: summary.checks },
      }
    }

    const liveRtspUrl = buildVigiLiveRtspUrl({
      host: nvr.host,
      rtspPort: nvr.rtspPort,
      username: nvr.username,
      password,
      channelKey: camera.channelKey,
      streamProfile: camera.streamProfile,
    })

    const result = await this.probeRunner.run({
      nvr,
      password,
      liveRtspUrl,
    })

    const summary = toTestSummary(result)
    this.repositories.updateLocalCamera(cameraId, { lastTest: summary })

    return { cameraId, passed: result.passed, result }
  }

  async testEnabledCameras(): Promise<{
    results: Array<{
      cameraId: string
      passed: boolean
      result: NvrProbeSuiteResult
    }>
  }> {
    const enabled = this.repositories
      .listLocalCameras()
      .filter((camera) => camera.enabled)

    if (enabled.length === 0) {
      throw new CommissioningError(
        "no_enabled_cameras",
        "Enable at least one camera before running commissioning tests.",
      )
    }

    const results: Array<{
      cameraId: string
      passed: boolean
      result: NvrProbeSuiteResult
    }> = []

    for (const camera of enabled) {
      const tested = await this.testCamera(camera.id)
      if (tested) {
        results.push(tested)
      }
    }

    return { results }
  }

  async capturePreview(cameraId: string): Promise<{
    cameraId: string
    durationSeconds: number
    available: boolean
  } | null> {
    const camera = this.repositories.getLocalCameraById(cameraId)
    if (!camera) {
      return null
    }

    const rtspUrl = await this.localCameraManager.resolveCameraRtspUrl(cameraId)
    if (!rtspUrl) {
      throw new CommissioningError(
        "preview_unavailable",
        "Could not resolve RTSP URL for preview capture.",
      )
    }

    const outputPath = this.paths.commissioningPreviewForCamera(cameraId)
    mkdirSync(dirname(outputPath), { recursive: true })

    await this.previewClipRunner.extractClip({
      rtspUrl,
      outputPath,
      preRollSeconds: 0,
      postRollSeconds: PREVIEW_DURATION_SECONDS,
    })

    return {
      cameraId,
      durationSeconds: PREVIEW_DURATION_SECONDS,
      available: true,
    }
  }

  getPreviewPath(cameraId: string): string | null {
    const path = this.paths.commissioningPreviewForCamera(cameraId)
    return existsSync(path) ? path : null
  }

  async runFailoverDrill(resourceId: string): Promise<CommissioningDrillResult> {
    const baseConfig = this.getEdgeConfigV2()
    if (!baseConfig) {
      throw new CommissioningError(
        "missing_config",
        "Authorized Config v2 is required for failover drills.",
      )
    }

    const resource = baseConfig.resources.find(
      (entry) => entry.resourceId === resourceId,
    )
    if (!resource?.enabled) {
      throw new CommissioningError(
        "unknown_resource",
        "Resource is not in the authorized Config v2 resource list.",
      )
    }

    const routes = this.repositories
      .listLocalResourceRoutes(resourceId)
      .filter(
        (route) =>
          route.enabled && route.captureModes.includes("edge_buffer"),
      )
      .sort((left, right) => left.priority - right.priority)

    if (routes.length < 2) {
      const result: CommissioningDrillResult = {
        passed: true,
        primaryCameraId: routes[0]?.cameraId ?? null,
        selectedCameraId: routes[0]?.cameraId ?? null,
        selectionReason: "automatic_priority",
        skipped: true,
        message: "Single candidate — failover drill skipped.",
      }
      this.persistDrillResult(resourceId, result)
      this.updateFailoverReadyFlag()
      return result
    }

    const overlay = buildLocalConfigOverlay(this.repositories, baseConfig)
    const primaryRoute = routes[0]
    const primaryCamera = this.repositories.getLocalCameraById(
      primaryRoute.cameraId,
    )
    if (!primaryCamera) {
      throw new CommissioningError(
        "missing_camera",
        "Primary camera is missing from local inventory.",
      )
    }

    const priorHealth = this.repositories.getSourceHealthBySourceId(
      primaryCamera.id,
    )

    const now = new Date().toISOString()
    this.repositories.upsertSourceHealth({
      scope: "source",
      recorderId: primaryCamera.nvrId,
      sourceId: primaryCamera.id,
      status: "unhealthy",
      reasonCode: "probe_failed",
      consecutiveFailures: 99,
      consecutiveSuccesses: 0,
      cooldownUntil: null,
      observedAt: now,
      lastSuccessAt: priorHealth?.lastSuccessAt ?? null,
      failbackEligible: false,
      details: { commissioningDrill: true },
    })

    const repositories = this.repositories
    const healthLookup: SourceHealthLookup = {
      getStatus(sourceId: string): SourceHealthStatus | null {
        const row = repositories.getSourceHealthBySourceId(sourceId)
        return row?.status ?? "unknown"
      },
      getReasonCode(sourceId: string): string | null {
        const row = repositories.getSourceHealthBySourceId(sourceId)
        return row?.reasonCode ?? null
      },
    }

    const plan = selectCapturePlan({
      config: overlay,
      resourceId,
      health: healthLookup,
    })

    if (priorHealth) {
      this.repositories.upsertSourceHealth(priorHealth)
    } else {
      this.repositories.upsertSourceHealth({
        scope: "source",
        recorderId: primaryCamera.nvrId,
        sourceId: primaryCamera.id,
        status: "unknown",
        reasonCode: null,
        consecutiveFailures: 0,
        consecutiveSuccesses: 0,
        cooldownUntil: null,
        observedAt: now,
        lastSuccessAt: null,
        failbackEligible: false,
        details: {},
      })
    }

    const passed =
      plan.selected !== null &&
      plan.selected.sourceId !== primaryCamera.id &&
      plan.selected.selectionReason === "failover"

    const result: CommissioningDrillResult = {
      passed,
      primaryCameraId: primaryCamera.id,
      selectedCameraId: plan.selected?.sourceId ?? null,
      selectionReason: plan.selected?.selectionReason ?? null,
      message: passed
        ? "Fallback camera selected after simulated primary failure."
        : "Failover drill did not select a fallback camera.",
    }

    this.persistDrillResult(resourceId, result)
    this.updateFailoverReadyFlag()

    if (!passed) {
      throw new CommissioningError(
        "failover_drill_failed",
        result.message ?? "Failover drill failed.",
      )
    }

    return result
  }

  private persistDrillResult(
    resourceId: string,
    result: CommissioningDrillResult,
  ): void {
    const state = this.repositories.getCommissioningState()
    const drillResults = { ...state.drillResults, [resourceId]: result }
    this.repositories.updateCommissioningState({ drillResults })
  }

  private updateFailoverReadyFlag(): void {
    const mappedResourceIds = [
      ...new Set(
        this.repositories
          .listAllLocalResourceRoutes()
          .filter((route) => route.enabled)
          .map((route) => route.resourceId),
      ),
    ]

    if (mappedResourceIds.length === 0) {
      this.repositories.updateCommissioningState({ failoverReady: true })
      return
    }

    const state = this.repositories.getCommissioningState()
    const allReady = mappedResourceIds.every((resourceId) => {
      const enabledRoutes = this.repositories
        .listLocalResourceRoutes(resourceId)
        .filter((route) => route.enabled)
      if (enabledRoutes.length < 2) {
        return true
      }

      return state.drillResults[resourceId]?.passed === true
    })

    this.repositories.updateCommissioningState({ failoverReady: allReady })
  }

  buildRedactedPublishPayload(
    commissioned: boolean,
    reportVersion = this.repositories.getCommissioningState().reportVersion + 1,
  ): Record<string, unknown> {
    const nvrs = this.repositories.listLocalNvrs().map((nvr) => ({
      id: nvr.id,
      label: nvr.label,
      vendor: nvr.vendor,
      host: nvr.host,
      rtspPort: nvr.rtspPort,
      playbackPort: nvr.playbackPort ?? null,
      username: nvr.username,
      localConnectionKey: nvr.localConnectionKey,
      enabled: nvr.enabled,
      testChannelKey: nvr.testChannelKey,
      timeMode: nvr.timeMode,
      lastTest: nvr.lastTest
        ? {
            passed: nvr.lastTest.passed,
            testedAt: nvr.lastTest.testedAt,
            timeMode: nvr.lastTest.timeMode,
            checks: nvr.lastTest.checks.map((check) => ({
              check: check.check,
              passed: check.passed,
              message: check.message,
              ...(nonemptyOrNull(check.code)
                ? { code: check.code }
                : {}),
            })),
          }
        : null,
    }))

    const cameras = this.repositories.listLocalCameras().map((camera) => ({
      id: camera.id,
      nvrId: camera.nvrId,
      label: camera.label,
      channelKey: camera.channelKey,
      streamProfile: camera.streamProfile,
      codec: camera.codec,
      enabled: camera.enabled,
      lastTest: camera.lastTest
        ? {
            passed: camera.lastTest.passed,
            testedAt: camera.lastTest.testedAt,
            checks: camera.lastTest.checks.map((check) => ({
              check: check.check,
              passed: check.passed,
              message: check.message,
              ...(nonemptyOrNull(check.code)
                ? { code: check.code }
                : {}),
            })),
          }
        : null,
      healthStatus:
        this.repositories.getSourceHealthBySourceId(camera.id)?.status ?? null,
    }))

    const resourcePolicies = this.repositories.listLocalResourcePolicies()
    const resourceRoutes = this.repositories.listAllLocalResourceRoutes()
    const sourceHealth = this.repositories.listAllSourceHealth()

    const report = {
      commissioned,
      publishedAt: new Date().toISOString(),
      reportVersion,
      nvrs,
      cameras,
      resourcePolicies,
      resourceRoutes: resourceRoutes.map((route) => ({
        resourceId: route.resourceId,
        cameraId: route.cameraId,
        priority: route.priority,
        captureModes: route.captureModes,
        enabled: route.enabled,
      })),
      sourceHealth: sourceHealth.map((row) => ({
        scope: row.scope,
        recorderId: row.recorderId,
        sourceId: nonemptyOrNull(row.sourceId),
        status: row.status,
        reasonCode: nonemptyOrNull(row.reasonCode),
        observedAt: row.observedAt,
      })),
    }

    const payload = {
      ...report,
      reportChecksumSha256: createHash("sha256")
        .update(JSON.stringify(report))
        .digest("hex"),
    }

    scanForSecrets(payload)
    return payload
  }

  async publish(enrolled: boolean): Promise<{ publishedAt: string }> {
    if (!enrolled) {
      throw new CommissioningError(
        "not_enrolled",
        "Pairing is required before publishing commissioning data to PlayTT.",
      )
    }

    if (!this.client) {
      throw new CommissioningError(
        "client_unavailable",
        "Cloud client is not configured.",
      )
    }

    const reportVersion = this.repositories.getCommissioningState().reportVersion + 1
    const payload = this.buildRedactedPublishPayload(false, reportVersion)
    try {
      await this.client.publishCommissioning(payload)
    } catch (error) {
      rethrowAsCommissioningError(error, "publish_failed")
    }

    const publishedAt = new Date().toISOString()
    this.repositories.updateCommissioningState({ publishedAt, reportVersion })
    return { publishedAt }
  }

  async complete(enrolled: boolean): Promise<CommissioningStateRow> {
    const checklist = this.buildChecklist(enrolled)
    if (!checklist.canComplete) {
      throw new CommissioningError(
        "checklist_incomplete",
        checklist.blockingReasons.join(" "),
      )
    }

    if (!this.client) {
      throw new CommissioningError(
        "client_unavailable",
        "Cloud client is not configured.",
      )
    }

    const reportVersion = this.repositories.getCommissioningState().reportVersion + 1
    const payload = this.buildRedactedPublishPayload(true, reportVersion)
    try {
      await this.client.publishCommissioning(payload)
    } catch (error) {
      rethrowAsCommissioningError(error, "publish_failed")
    }

    const completedAt = new Date().toISOString()
    return this.repositories.updateCommissioningState({
      completed: true,
      completedAt,
      publishedAt: completedAt,
      reportVersion,
      lastError: null,
    })
  }
}
