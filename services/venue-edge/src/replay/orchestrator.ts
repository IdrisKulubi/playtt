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
import { ReplayTimer } from "./timing"
import type {
  LocalClipPublication,
  LocalClipServer,
} from "../local-playback/clip-server"
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
  /** Serves fresh clips to the venue TVs; absent or stopped = R2 only. */
  localClips?: LocalClipServer | null
}

const PROGRESS_SEQUENCE = [
  "edge_acknowledged",
  "capturing",
  "extracting",
  "uploading",
  "verifying",
  "ready",
] as const

type ProgressStatus = (typeof PROGRESS_SEQUENCE)[number]

/**
 * These are status updates only; the work doesn't depend on the cloud's
 * answer. They are sent in the background (in order) so capture, cut and
 * upload never wait on a round trip. "verifying" and "ready" stay blocking:
 * verifying is what makes the cloud check the upload and tell the TV.
 */
const BACKGROUND_PROGRESS = new Set<ProgressStatus>([
  "edge_acknowledged",
  "capturing",
  "extracting",
  "uploading",
])

const PROGRESS_RETRY_DELAY_MS = 300

/**
 * Sends progress reports one at a time, in order, without blocking the
 * caller. If one fails it stops (later statuses would be rejected as out of
 * order) and `drain()` retries what's left before the capture moves on.
 */
type ProgressExtras = { localPlayback?: LocalClipPublication }

export class ProgressPipeline {
  private readonly queue: Array<{
    status: ProgressStatus
    extras?: ProgressExtras
  }> = []
  private worker: Promise<void> | null = null
  private error: unknown = null

  constructor(
    private readonly send: (
      status: ProgressStatus,
      extras?: ProgressExtras,
    ) => Promise<void>,
    private readonly retryDelayMs = PROGRESS_RETRY_DELAY_MS,
  ) {}

  enqueue(status: ProgressStatus, extras?: ProgressExtras): void {
    this.queue.push({ status, extras })
    if (!this.worker && this.error === null) {
      this.worker = this.run().finally(() => {
        this.worker = null
      })
    }
  }

  /** Waits until every queued report is accepted; throws if one can't be sent. */
  async drain(): Promise<void> {
    while (this.worker) {
      await this.worker
    }

    if (this.error === null) {
      return
    }

    this.error = null
    try {
      while (this.queue.length > 0) {
        const item = this.queue[0]!
        await this.send(item.status, item.extras)
        this.queue.shift()
      }
    } catch (error) {
      // Keep the unsent statuses queued (and the queue paused) for next time.
      this.error = error
      throw error
    }
  }

  /** Waits for in-flight reports without throwing (used on the failure path). */
  async settle(): Promise<void> {
    while (this.worker) {
      await this.worker.catch(() => undefined)
    }
  }

  private async run(): Promise<void> {
    while (this.queue.length > 0) {
      const { status, extras } = this.queue[0]!
      try {
        await this.sendWithRetry(status, extras)
        this.queue.shift()
      } catch (error) {
        this.error = error
        safeLog("warn", "Background replay progress failed; will retry", {
          status,
          message: error instanceof Error ? error.message : String(error),
        })
        return
      }
    }
  }

  private async sendWithRetry(
    status: ProgressStatus,
    extras?: ProgressExtras,
  ): Promise<void> {
    try {
      await this.send(status, extras)
    } catch {
      await new Promise((resolve) => setTimeout(resolve, this.retryDelayMs))
      await this.send(status, extras)
    }
  }
}

export class ReplayOrchestrator {
  private readonly limiter
  private readonly uploadResults = new Map<string, DirectUploadResult>()
  /** Venue-LAN links for clips cut but not yet reported to the cloud. */
  private readonly localPublications = new Map<string, LocalClipPublication>()

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
    const receivedAtMs = Date.now()
    return this.limiter.run(() =>
      this.handleCapture(commandId, payload, { ...options, receivedAtMs })
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
    options: {
      resumeFrom?: string
      correlationId?: string
      receivedAtMs?: number
    }
  ): Promise<void> {
    const correlationId = options.correlationId
    const timer = new ReplayTimer(
      Date.parse(payload.captureAt),
      Date.now,
      options.receivedAtMs
    )
    timer.set(
      "queueWaitMs",
      options.receivedAtMs === undefined
        ? null
        : Date.now() - options.receivedAtMs
    )
    timer.set("clipSeconds", payload.preRollSeconds + payload.postRollSeconds)
    timer.set("resumedFrom", options.resumeFrom ?? null)
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

    const progress = new ProgressPipeline((status, extras) =>
      this.reportProgress(payload.replayRequestId, status, extras, correlationId)
    )

    try {
      for (
        let index = startIndex;
        index < PROGRESS_SEQUENCE.length;
        index += 1
      ) {
        const status = PROGRESS_SEQUENCE[index]!
        await this.advance(payload, status, progress, timer, correlationId)
      }

      safeLog("info", "Replay timing", {
        replayRequestId: payload.replayRequestId,
        ...timer.summary("ready"),
      })

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
      this.localPublications.delete(payload.replayRequestId)
      // Let queued "capturing"/"extracting" reports land first, otherwise the
      // cloud rejects the failure status as out of order.
      await progress.settle()
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
      safeLog("info", "Replay timing", {
        replayRequestId: payload.replayRequestId,
        failureReason,
        lastStatus: lastStatus ?? null,
        ...timer.summary("failed"),
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
    status: ProgressStatus,
    progress: ProgressPipeline,
    timer: ReplayTimer,
    correlationId?: string,
  ): Promise<void> {
    if (BACKGROUND_PROGRESS.has(status)) {
      // "uploading" carries the venue-LAN links, so the TV can start the clip
      // while the upload runs.
      const localPlayback =
        status === "uploading"
          ? this.localPublications.get(payload.replayRequestId)
          : undefined
      progress.enqueue(status, localPlayback ? { localPlayback } : undefined)
      if (localPlayback) {
        this.localPublications.delete(payload.replayRequestId)
      }
    } else {
      // The cloud must have every earlier status before it can verify.
      await timer.time(`${status}DrainMs`, () => progress.drain())
      const uploadResult = this.uploadResults.get(payload.replayRequestId)
      // "verifying" is the call that makes the cloud check R2 and tell the TV.
      await timer.time(`${status}ReportMs`, () =>
        this.reportProgress(payload.replayRequestId, status, {
          checksumSha256: uploadResult?.checksumSha256,
          sizeBytes: uploadResult?.bytesUploaded,
        }, correlationId)
      )
      if (status === "verifying") {
        timer.markSinceTap("tapToVerifiedMs")
      }
    }

    this.deps.repositories.updateReplayJob(payload.replayRequestId, {
      status: status as never,
    })

    if (status === "capturing") {
      await this.assertCaptureSourceReady(payload)
    }

    if (status === "extracting") {
      await timer.time("extractMs", () => this.extractClip(payload, timer))
      await this.publishLocally(payload, timer)
    }

    if (status === "uploading") {
      await this.uploadClip(payload, timer)
    }
  }

  /**
   * Hands the cut clip to the local clip server. Never fails the replay: if
   * it doesn't work the TV simply waits for the R2 copy, as before.
   */
  private async publishLocally(
    payload: import("../cloud/client.ts").CaptureReplayPayload,
    timer: ReplayTimer,
  ): Promise<void> {
    const localClips = this.deps.localClips
    if (!localClips?.isRunning() || this.deps.env.mode === "simulate") {
      timer.set("localPlayback", false)
      return
    }

    const job = this.deps.repositories.getReplayJob(payload.replayRequestId)
    if (!job?.localClipPath) {
      timer.set("localPlayback", false)
      return
    }

    const startedAt = Date.now()
    try {
      const publication = await localClips.publish(
        job.localClipPath,
        payload.preRollSeconds + payload.postRollSeconds,
      )
      if (publication) {
        this.localPublications.set(payload.replayRequestId, publication)
      }
      timer.set("localPlayback", Boolean(publication))
    } catch (error) {
      timer.set("localPlayback", false)
      safeLog("warn", "Could not publish clip for local playback", {
        replayRequestId: payload.replayRequestId,
        message: error instanceof Error ? error.message : String(error),
      })
    } finally {
      timer.set("localPublishMs", Date.now() - startedAt)
    }
  }

  private async reportProgress(
    replayRequestId: string,
    status: ProgressStatus,
    extras?: {
      checksumSha256?: string
      sizeBytes?: number
      localPlayback?: LocalClipPublication
    },
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
        ...(extras?.localPlayback
          ? { localPlayback: extras.localPlayback }
          : {}),
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
    payload: import("../cloud/client.ts").CaptureReplayPayload,
    timer?: ReplayTimer
  ): Promise<void> {
    const edgeConfig = this.deps.getEdgeConfig()
    const edgeConfigV2 = this.deps.getEdgeConfigV2?.() ?? null
    const job = this.deps.repositories.getReplayJob(payload.replayRequestId)
    const captureConfigV2 = job?.configSnapshot ?? edgeConfigV2
    const plan = this.resolveCapturePlan(payload, job)

    if (!plan) {
      await this.extractClipLegacy(payload, edgeConfig, edgeConfigV2, timer)
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
          timer?.merge(result.timings)
        }

        timer?.set("captureMode", attempt.captureMode)
        timer?.set("captureAttempt", attempt.ordinal)
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
    edgeConfigV2: EdgeConfigV2 | null,
    timer?: ReplayTimer
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
        timer?.merge(result.timings)
        timer?.set("captureMode", adapter.name)

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
    payload: import("../cloud/client.ts").CaptureReplayPayload,
    timer?: ReplayTimer
  ): Promise<void> {
    const job = this.deps.repositories.getReplayJob(payload.replayRequestId)
    if (!job?.localClipPath) {
      throw new Error("upload_failed")
    }

    const currentGrant = job.uploadGrant ?? payload.uploadGrant
    const grantStartedAt = Date.now()
    const grant = await renewUploadGrant(
      this.deps.client,
      payload.mediaAssetId,
      currentGrant
    )
    timer?.set("grantMs", Date.now() - grantStartedAt)
    timer?.set("grantRenewed", grant !== currentGrant)

    this.deps.repositories.updateReplayJob(payload.replayRequestId, {
      uploadGrant: grant,
    })

    const uploadStartedAt = Date.now()
    const uploaded = await uploadToPresignedUrl({
      grant,
      filePath: job.localClipPath,
      fetchImpl: this.deps.fetchImpl,
    })
    // Includes reading and hashing the file (small next to the PUT itself).
    timer?.set("uploadMs", Date.now() - uploadStartedAt)
    timer?.set("sizeBytes", uploaded.bytesUploaded)

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
