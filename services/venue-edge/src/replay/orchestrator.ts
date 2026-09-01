import { mkdir } from "node:fs/promises"
import { join } from "node:path"

import { commandMatchesActiveConfig } from "../cameras/source"
import { getCameraForCapture, getCameraForResource } from "../cameras/registry"
import type { EdgeV1Client, EdgeConfig } from "../cloud/client"
import type { EdgeConfigV2, ReplayCaptureMode } from "../cloud/config-v2"
import type { VenueEdgeEnv } from "../config/env"
import { createReplayLimiter } from "../concurrency/limits"
import type { SourceHealthEngine } from "../health/engine"
import { safeLog } from "../health/metrics"
import type {
  EdgeRepositories,
  ReplayJobRow,
} from "../local-storage/repositories"
import type { LocalStoragePaths } from "../local-storage/paths"
import { runDeterministicSimulatorCapture } from "../simulator/engine"
import {
  buildSelectionAckResult,
  selectCapturePlan,
  type SelectCapturePlanResult,
} from "../selection/select-source"
import type { SimulatorScenario } from "../simulator/scenario"
import { shouldSimulatedExtractionFail } from "../simulator/scenario"
import {
  enforceWorkspaceDiskBudget,
  pruneReplayWorkspace,
} from "../local-storage/prune"
import {
  uploadToPresignedUrl,
  type DirectUploadResult,
} from "../upload/direct-upload"
import { renewUploadGrant } from "../upload/grant-client"
import { RollingBufferVideoAdapter } from "../video-adapters/rolling-buffer-adapter"
import { VigiNvrPlaybackAdapter } from "../video-adapters/vigi-nvr-playback-adapter"
import type { VideoAdapter } from "../video-adapters/types"

export interface ReplayOrchestratorDeps {
  env: VenueEdgeEnv
  client: EdgeV1Client
  repositories: EdgeRepositories
  paths: LocalStoragePaths
  getEdgeConfig: () => EdgeConfig | null
  getEdgeConfigV2?: () => EdgeConfigV2 | null
  healthEngine?: SourceHealthEngine | null
  getSimulatorScenario?: () => SimulatorScenario | null
  fetchImpl?: typeof fetch
}

const PROGRESS_SEQUENCE = [
  "edge_acknowledged",
  "capturing",
  "extracting",
  "uploading",
  "verifying",
  "ready",
] as const

export class ReplayOrchestrator {
  private readonly limiter
  private readonly uploadResults = new Map<string, DirectUploadResult>()

  constructor(private readonly deps: ReplayOrchestratorDeps) {
    this.limiter = createReplayLimiter(deps.env.maxConcurrentReplays)
  }

  getCapacityMetrics(): {
    activeReplayJobs: number
    replayQueueDepth: number
    maxConcurrentReplays: number
  } {
    return {
      activeReplayJobs: this.limiter.activeCount,
      replayQueueDepth: this.limiter.queueDepth,
      maxConcurrentReplays: this.deps.env.maxConcurrentReplays,
    }
  }

  async resumeJob(replayRequestId: string): Promise<void> {
    const job = this.deps.repositories.getReplayJob(replayRequestId)
    if (!job || job.status === "ready" || job.status === "failed") {
      return
    }

    const command = this.deps.repositories.getCommandById(job.commandId)
    if (!command) {
      return
    }

    await this.processCaptureReplay(command.id, command.payload, {
      resumeFrom: job.status,
    })
  }

  async processCaptureReplay(
    commandId: string,
    payload: Parameters<ReplayOrchestrator["handleCapture"]>[1],
    options: { resumeFrom?: string; correlationId?: string } = {}
  ): Promise<void> {
    return this.limiter.run(() =>
      this.handleCapture(commandId, payload, options)
    )
  }

  private clientForCorrelation(correlationId?: string): EdgeV1Client {
    if (!correlationId) {
      return this.deps.client
    }

    return this.deps.client.withCorrelationId(correlationId)
  }

  private async handleCapture(
    commandId: string,
    payload: import("../cloud/client.ts").CaptureReplayPayload,
    options: { resumeFrom?: string; correlationId?: string }
  ): Promise<void> {
    const correlationId = options.correlationId
    const edgeConfig = this.deps.getEdgeConfig()
    const edgeConfigV2 = this.deps.getEdgeConfigV2?.() ?? null
    const existingJob = this.deps.repositories.getReplayJob(
      payload.replayRequestId
    )
    const validationConfigV2 =
      options.resumeFrom && existingJob?.configSnapshot
        ? existingJob.configSnapshot
        : edgeConfigV2
    const validation = commandMatchesActiveConfig(
      edgeConfig,
      validationConfigV2,
      payload.resourceId,
      payload.configRevisionId
    )

    if (!validation.accepted) {
      safeLog("warn", "Rejected capture_replay command", {
        commandId,
        replayRequestId: payload.replayRequestId,
        reason: validation.reason,
      })

      this.deps.repositories.updateCommandStatus(commandId, "rejected", {
        reason: validation.reason,
      })

      await this.deps.client.acknowledgeCommand(commandId, {
        idempotencyKey: `reject-${commandId}`,
        success: false,
        result: { reason: validation.reason },
      })

      return
    }

    const job = this.deps.repositories.createReplayJob({
      commandId,
      payload,
      configSnapshot: edgeConfigV2,
      status: "pending",
    })

    if (job.status === "ready") {
      safeLog("info", "Duplicate capture_replay ignored", {
        replayRequestId: payload.replayRequestId,
      })
      return
    }

    if (
      job.status !== "pending" &&
      job.status !== "failed" &&
      !options.resumeFrom
    ) {
      safeLog("info", "Capture already in progress", {
        replayRequestId: payload.replayRequestId,
        status: job.status,
      })
      return
    }

    const startIndex = options.resumeFrom
      ? Math.max(0, PROGRESS_SEQUENCE.indexOf(options.resumeFrom as never))
      : job.status === "pending" || job.status === "failed"
        ? 0
        : Math.max(0, PROGRESS_SEQUENCE.indexOf(job.status as never))

    try {
      for (
        let index = startIndex;
        index < PROGRESS_SEQUENCE.length;
        index += 1
      ) {
        const status = PROGRESS_SEQUENCE[index]!
        await this.advance(payload, status, commandId, correlationId)
      }

      const ackExtras = this.buildSelectionAckExtras(payload.replayRequestId)

      await this.deps.client.acknowledgeCommand(commandId, {
        idempotencyKey: `ack-${commandId}`,
        success: true,
        result: {
          replayRequestId: payload.replayRequestId,
          ...ackExtras,
        },
      })

      this.deps.repositories.updateCommandStatus(commandId, "acknowledged", {
        replayRequestId: payload.replayRequestId,
        ...ackExtras,
      })

      this.deps.healthEngine?.recordReplayOutcome(
        this.deps.repositories.getReplayJob(payload.replayRequestId)
          ?.lockedSourceId ?? null,
        "probe_failed",
        true
      )

      await pruneReplayWorkspace(this.deps.paths, payload.replayRequestId)
      await enforceWorkspaceDiskBudget({
        env: this.deps.env,
        paths: this.deps.paths,
        repositories: this.deps.repositories,
      })
    } catch (error) {
      const failureReason =
        error instanceof Error ? error.message : "capture_failed"
      const lastStatus = this.deps.repositories.getReplayJob(
        payload.replayRequestId
      )?.status
      const terminalStatus = mapReplayFailureStatus(failureReason, lastStatus)

      safeLog("error", "Replay capture failed", {
        replayRequestId: payload.replayRequestId,
        failureReason,
        lastStatus,
        terminalStatus,
      })

      const healthReason = failureReason.includes("upload")
        ? "upload_failed"
        : "extraction_failed"
      this.deps.healthEngine?.recordReplayOutcome(
        this.deps.repositories.getReplayJob(payload.replayRequestId)
          ?.lockedSourceId ?? null,
        healthReason,
        false
      )

      try {
        const client = this.clientForCorrelation(correlationId)
        await client.reportReplayProgress(payload.replayRequestId, {
          status: terminalStatus,
          failureReason,
        })
      } catch (progressError) {
        safeLog("error", "Failed to report replay failure progress", {
          replayRequestId: payload.replayRequestId,
          message:
            progressError instanceof Error
              ? progressError.message
              : String(progressError),
        })

        try {
          const client = this.clientForCorrelation(correlationId)
          await client.reportReplayProgress(payload.replayRequestId, {
            status: "failed",
            failureReason,
          })
        } catch {
          // Keep VenueEdge alive even if cloud rejects the failure report.
        }
      }

      this.deps.repositories.updateReplayJob(payload.replayRequestId, {
        status: "failed",
        failureReason,
      })

      const ackExtras = this.buildSelectionAckExtras(payload.replayRequestId)

      this.deps.repositories.updateCommandStatus(commandId, "failed", {
        reason: failureReason,
        ...ackExtras,
      })

      try {
        await this.deps.client.acknowledgeCommand(commandId, {
          idempotencyKey: `fail-${commandId}`,
          success: false,
          result: {
            reason: failureReason,
            ...ackExtras,
          },
        })
      } catch (ackError) {
        safeLog("error", "Failed to acknowledge failed capture command", {
          commandId,
          message:
            ackError instanceof Error ? ackError.message : String(ackError),
        })
      }

      await pruneReplayWorkspace(this.deps.paths, payload.replayRequestId)
      await enforceWorkspaceDiskBudget({
        env: this.deps.env,
        paths: this.deps.paths,
        repositories: this.deps.repositories,
      })
    }
  }

  private buildSelectionAckExtras(
    replayRequestId: string
  ): Record<string, unknown> {
    const attempts = this.deps.repositories.listCaptureAttempts(replayRequestId)

    if (attempts.length === 0) {
      return {}
    }

    const job = this.deps.repositories.getReplayJob(replayRequestId)
    const succeeded = attempts.find((attempt) => attempt.status === "succeeded")
    const configRevisionId = attempts[0]?.configRevisionId ?? ""

    const succeededSelectionReason =
      (succeeded?.details?.selectionReason as string | undefined) ?? null

    const plan: SelectCapturePlanResult = {
      attempts: attempts.map((attempt) => ({
        ordinal: attempt.ordinal,
        sourceId: attempt.sourceId,
        recorderId: attempt.recorderId,
        captureMode: attempt.captureMode,
        status: attempt.status,
        reasonCode: attempt.reasonCode,
        selectionReason:
          (attempt.details.selectionReason as
            | "manual_pin"
            | "automatic_priority"
            | "failover"
            | "locked_in_progress") ?? "automatic_priority",
      })),
      selected: succeeded
        ? {
            sourceId: succeeded.sourceId,
            recorderId: succeeded.recorderId,
            captureMode: succeeded.captureMode,
            selectionReason:
              (succeededSelectionReason as
                | "manual_pin"
                | "automatic_priority"
                | "failover"
                | "locked_in_progress") ?? "automatic_priority",
          }
        : null,
      terminalReason: succeeded
        ? null
        : attempts.some((attempt) => attempt.reasonCode === "source_disabled")
          ? "source_disabled"
          : "no_healthy_source",
      configRevisionId,
    }

    return buildSelectionAckResult({
      plan,
      attempts: attempts.map((attempt) => ({
        ordinal: attempt.ordinal,
        sourceId: attempt.sourceId,
        captureMode: attempt.captureMode,
        status: attempt.status,
        reasonCode: attempt.reasonCode,
      })),
      selectedSourceId: succeeded?.sourceId ?? job?.lockedSourceId,
      recorderId: succeeded?.recorderId,
      captureMode: succeeded?.captureMode ?? job?.lockedCaptureMode,
      selectionReason: plan.selected?.selectionReason ?? null,
    })
  }

  private async advance(
    payload: import("../cloud/client.ts").CaptureReplayPayload,
    status: (typeof PROGRESS_SEQUENCE)[number],
    commandId: string,
    correlationId?: string,
  ): Promise<void> {
    const uploadResult = this.uploadResults.get(payload.replayRequestId)

    await this.reportProgress(payload.replayRequestId, status, {
      checksumSha256:
        status === "verifying" || status === "ready"
          ? uploadResult?.checksumSha256
          : undefined,
      sizeBytes:
        status === "verifying" || status === "ready"
          ? uploadResult?.bytesUploaded
          : undefined,
    }, correlationId)

    this.deps.repositories.updateReplayJob(payload.replayRequestId, {
      status: status as never,
    })

    if (status === "capturing") {
      await this.assertCaptureSourceReady(payload)
    }

    if (status === "extracting") {
      await this.extractClip(payload)
    }

    if (status === "uploading") {
      await this.uploadClip(payload)
    }
  }

  private async reportProgress(
    replayRequestId: string,
    status: (typeof PROGRESS_SEQUENCE)[number],
    extras?: { checksumSha256?: string; sizeBytes?: number },
    correlationId?: string,
  ): Promise<void> {
    const client = this.clientForCorrelation(correlationId)
    try {
      await client.reportReplayProgress(replayRequestId, {
        status,
        ...(extras?.checksumSha256
          ? { checksumSha256: extras.checksumSha256 }
          : {}),
        ...(extras?.sizeBytes ? { sizeBytes: extras.sizeBytes } : {}),
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (
        message.includes("INVALID_REPLAY_REQUEST_TRANSITION") ||
        message.includes("Cannot transition")
      ) {
        safeLog("warn", "Ignored stale replay progress transition", {
          replayRequestId,
          status,
          message,
        })
        return
      }

      throw error
    }
  }

  private resolveCapturePlan(
    payload: import("../cloud/client.ts").CaptureReplayPayload,
    job: ReplayJobRow | null
  ): SelectCapturePlanResult | null {
    const edgeConfigV2 =
      job?.configSnapshot ?? this.deps.getEdgeConfigV2?.() ?? null

    if (!edgeConfigV2) {
      return null
    }

    const lockedSelection =
      job?.lockedSourceId && job?.lockedCaptureMode
        ? {
            sourceId: job.lockedSourceId,
            captureMode: job.lockedCaptureMode,
          }
        : null

    const healthEngine = this.deps.healthEngine

    return selectCapturePlan({
      config: edgeConfigV2,
      resourceId: payload.resourceId,
      health: {
        getStatus: (sourceId) =>
          healthEngine?.getSourceHealth(sourceId)?.status ?? null,
        getReasonCode: (sourceId) =>
          healthEngine?.getSourceHealth(sourceId)?.reasonCode ?? null,
      },
      lockedSelection,
    })
  }

  private persistCapturePlan(
    replayRequestId: string,
    plan: SelectCapturePlanResult
  ): void {
    for (const attempt of plan.attempts) {
      this.deps.repositories.upsertCaptureAttempt({
        replayRequestId,
        ordinal: attempt.ordinal,
        sourceId: attempt.sourceId,
        recorderId: attempt.recorderId,
        captureMode: attempt.captureMode,
        status: attempt.status,
        reasonCode: attempt.reasonCode,
        configRevisionId: plan.configRevisionId,
        details: { selectionReason: attempt.selectionReason },
      })
    }
  }

  private async extractClip(
    payload: import("../cloud/client.ts").CaptureReplayPayload
  ): Promise<void> {
    const edgeConfig = this.deps.getEdgeConfig()
    const edgeConfigV2 = this.deps.getEdgeConfigV2?.() ?? null
    const job = this.deps.repositories.getReplayJob(payload.replayRequestId)
    const captureConfigV2 = job?.configSnapshot ?? edgeConfigV2
    const plan = this.resolveCapturePlan(payload, job)

    if (!plan) {
      await this.extractClipLegacy(payload, edgeConfig, edgeConfigV2)
      return
    }

    this.persistCapturePlan(payload.replayRequestId, plan)

    if (plan.terminalReason && !plan.selected) {
      throw new Error(plan.terminalReason)
    }

    const pendingAttempts = plan.attempts.filter(
      (attempt) => attempt.status === "pending"
    )

    if (pendingAttempts.length === 0) {
      throw new Error(plan.terminalReason ?? "no_healthy_source")
    }

    const simulate = this.deps.env.mode === "simulate"
    const outputDir = this.deps.paths.pendingForReplay(payload.replayRequestId)
    await mkdir(outputDir, { recursive: true })
    const outputPath = join(outputDir, "clip.mp4")

    for (const attempt of pendingAttempts) {
      const startedAt = new Date().toISOString()

      this.deps.repositories.updateCaptureAttempt(
        payload.replayRequestId,
        attempt.ordinal,
        {
          status: "pending",
          startedAt,
        }
      )

      const camera = getCameraForCapture(
        this.deps.env,
        captureConfigV2!,
        attempt.sourceId,
        payload.resourceId
      )

      if (!camera) {
        this.deps.repositories.updateCaptureAttempt(
          payload.replayRequestId,
          attempt.ordinal,
          {
            status: "failed",
            reasonCode: "source_disabled",
            completedAt: new Date().toISOString(),
          }
        )
        continue
      }

      try {
        if (simulate) {
          safeLog("warn", "Replay capture is using simulator output", {
            replayRequestId: payload.replayRequestId,
            sourceId: attempt.sourceId,
            captureMode: attempt.captureMode,
            playable: false,
          })
          if (
            shouldSimulatedExtractionFail(
              this.deps.getSimulatorScenario?.() ?? null,
              attempt.sourceId
            )
          ) {
            throw new Error("extraction_failed")
          }

          await runDeterministicSimulatorCapture({
            payload,
            paths: this.deps.paths,
            repositories: this.deps.repositories,
          })
        } else {
          const adapter = this.buildAdapter(
            camera,
            attempt.captureMode,
            simulate
          )

          if (!(await adapter.isAvailable())) {
            throw new Error("extraction_failed")
          }

          const result = await adapter.extractClip({
            replayRequestId: payload.replayRequestId,
            captureAt: payload.captureAt,
            preRollSeconds: payload.preRollSeconds,
            postRollSeconds: payload.postRollSeconds,
            outputPath,
          })

          this.deps.repositories.updateReplayJob(payload.replayRequestId, {
            localClipPath: result.outputPath,
          })
        }

        const completedAt = new Date().toISOString()

        this.deps.repositories.updateCaptureAttempt(
          payload.replayRequestId,
          attempt.ordinal,
          {
            status: "succeeded",
            completedAt,
          }
        )

        this.deps.repositories.updateReplayJob(payload.replayRequestId, {
          lockedSourceId: attempt.sourceId,
          lockedCaptureMode: attempt.captureMode,
        })

        return
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        const reasonCode =
          message === "buffer_missing" || message === "clip_validation_failed"
            ? "extraction_failed"
            : message

        this.deps.repositories.updateCaptureAttempt(
          payload.replayRequestId,
          attempt.ordinal,
          {
            status: "failed",
            reasonCode,
            completedAt: new Date().toISOString(),
          }
        )

        this.deps.healthEngine?.recordSourceObservation(attempt.sourceId, {
          kind: "soft_failure",
          reasonCode: "extraction_failed",
          observedAt: new Date().toISOString(),
        })

        safeLog("warn", "Capture attempt failed", {
          replayRequestId: payload.replayRequestId,
          sourceId: attempt.sourceId,
          captureMode: attempt.captureMode,
          message: message.slice(0, 400),
        })
      }
    }

    throw new Error("no_healthy_source")
  }

  private buildAdapter(
    camera: import("../cameras/source.ts").CameraSourceConfig,
    captureMode: ReplayCaptureMode,
    simulate: boolean
  ): VideoAdapter {
    if (captureMode === "edge_buffer") {
      return new RollingBufferVideoAdapter(
        camera,
        this.deps.paths,
        this.deps.repositories,
        { simulate }
      )
    }

    return new VigiNvrPlaybackAdapter(camera.rtspUrl)
  }

  private async extractClipLegacy(
    payload: import("../cloud/client.ts").CaptureReplayPayload,
    edgeConfig: EdgeConfig | null,
    edgeConfigV2: EdgeConfigV2 | null
  ): Promise<void> {
    const camera = getCameraForResource(
      this.deps.env,
      edgeConfig,
      edgeConfigV2,
      payload.resourceId
    )
    const simulate = this.deps.env.mode === "simulate"

    if (simulate) {
      safeLog("warn", "Replay capture is using simulator output", {
        replayRequestId: payload.replayRequestId,
        captureMode: payload.sourceType,
        playable: false,
      })
      await runDeterministicSimulatorCapture({
        payload,
        paths: this.deps.paths,
        repositories: this.deps.repositories,
      })
      return
    }

    const adapters: VideoAdapter[] = [
      new RollingBufferVideoAdapter(
        camera,
        this.deps.paths,
        this.deps.repositories,
        { simulate }
      ),
      new VigiNvrPlaybackAdapter(camera.rtspUrl),
    ]

    const outputDir = this.deps.paths.pendingForReplay(payload.replayRequestId)
    await mkdir(outputDir, { recursive: true })
    const outputPath = join(outputDir, "clip.mp4")

    let lastError: Error | null = null

    for (const adapter of adapters) {
      if (!(await adapter.isAvailable())) {
        continue
      }

      try {
        const result = await adapter.extractClip({
          replayRequestId: payload.replayRequestId,
          captureAt: payload.captureAt,
          preRollSeconds: payload.preRollSeconds,
          postRollSeconds: payload.postRollSeconds,
          outputPath,
        })

        this.deps.repositories.updateReplayJob(payload.replayRequestId, {
          localClipPath: result.outputPath,
        })

        return
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
        safeLog("warn", "Clip adapter failed", {
          adapter: adapter.name,
          message: lastError.message.slice(0, 400),
        })
        if (
          lastError.message === "buffer_missing" ||
          lastError.message === "clip_validation_failed"
        ) {
          lastError = new Error("extraction_failed")
        }
      }
    }

    throw lastError ?? new Error("extraction_failed")
  }

  private async assertCaptureSourceReady(
    payload: import("../cloud/client.ts").CaptureReplayPayload
  ): Promise<void> {
    const edgeConfig = this.deps.getEdgeConfig()
    const edgeConfigV2 = this.deps.getEdgeConfigV2?.() ?? null
    const job = this.deps.repositories.getReplayJob(payload.replayRequestId)
    const captureConfigV2 = job?.configSnapshot ?? edgeConfigV2
    const plan = this.resolveCapturePlan(payload, job)

    if (plan) {
      const firstBufferAttempt = plan.attempts.find(
        (attempt) =>
          attempt.status === "pending" && attempt.captureMode === "edge_buffer"
      )

      if (!firstBufferAttempt) {
        return
      }

      if (this.deps.env.mode === "simulate") {
        return
      }

      const camera = getCameraForCapture(
        this.deps.env,
        captureConfigV2!,
        firstBufferAttempt.sourceId,
        payload.resourceId
      )

      if (camera?.rtspUrl) {
        return
      }

      const captureAt = Date.parse(payload.captureAt)
      const windowStart = new Date(
        captureAt - payload.preRollSeconds * 1000
      ).toISOString()
      const windowEnd = new Date(
        captureAt + payload.postRollSeconds * 1000
      ).toISOString()
      const segments = this.deps.repositories.listBufferSegmentsForWindow(
        firstBufferAttempt.sourceId,
        windowStart,
        windowEnd
      )

      if (segments.length === 0) {
        throw new Error("buffer_missing")
      }

      return
    }

    const camera = getCameraForResource(
      this.deps.env,
      edgeConfig,
      edgeConfigV2,
      payload.resourceId
    )

    if (this.deps.env.mode === "simulate" || camera.rtspUrl) {
      return
    }

    const captureAt = Date.parse(payload.captureAt)
    const windowStart = new Date(
      captureAt - payload.preRollSeconds * 1000
    ).toISOString()
    const windowEnd = new Date(
      captureAt + payload.postRollSeconds * 1000
    ).toISOString()
    const segments = this.deps.repositories.listBufferSegmentsForWindow(
      camera.cameraId,
      windowStart,
      windowEnd
    )

    if (segments.length === 0) {
      throw new Error("buffer_missing")
    }
  }

  private async uploadClip(
    payload: import("../cloud/client.ts").CaptureReplayPayload
  ): Promise<void> {
    const job = this.deps.repositories.getReplayJob(payload.replayRequestId)
    if (!job?.localClipPath) {
      throw new Error("upload_failed")
    }

    const grant = await renewUploadGrant(
      this.deps.client,
      payload.mediaAssetId,
      job.uploadGrant ?? payload.uploadGrant
    )

    this.deps.repositories.updateReplayJob(payload.replayRequestId, {
      uploadGrant: grant,
    })

    const uploaded = await uploadToPresignedUrl({
      grant,
      filePath: job.localClipPath,
      fetchImpl: this.deps.fetchImpl,
    })

    this.uploadResults.set(payload.replayRequestId, uploaded)
  }
}

export function mapReplayFailureStatus(
  reason: string,
  lastStatus?: string
): import("../cloud/client.ts").ReplayProgressStatus {
  if (reason === "buffer_missing") {
    if (
      lastStatus === "extracting" ||
      lastStatus === "uploading" ||
      lastStatus === "verifying"
    ) {
      return "extraction_failed"
    }

    return "buffer_missing"
  }

  if (reason === "extraction_failed") {
    return "extraction_failed"
  }

  if (reason === "upload_failed") {
    return "upload_failed"
  }

  if (reason === "no_healthy_source" || reason === "no_source_configured") {
    return "extraction_failed"
  }

  return "failed"
}
