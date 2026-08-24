import { createHash } from "node:crypto"
import { mkdir, readFile } from "node:fs/promises"
import { join } from "node:path"

import {
  commandMatchesEdgeAssignment,
  resolveCameraSource,
} from "../cameras/source"
import type { EdgeV1Client, EdgeConfig } from "../cloud/client"
import type { VenueEdgeEnv } from "../config/env"
import { createReplayLimiter } from "../concurrency/limits"
import { safeLog } from "../health/metrics"
import type { EdgeRepositories } from "../local-storage/repositories"
import type { LocalStoragePaths } from "../local-storage/paths"
import { runDeterministicSimulatorCapture } from "../simulator/engine"
import {
  uploadToPresignedUrl,
  type DirectUploadResult,
} from "../upload/direct-upload"
import { renewUploadGrant } from "../upload/grant-client"
import { LiveRtspClipAdapter } from "../video-adapters/live-rtsp-adapter"
import { RollingBufferVideoAdapter } from "../video-adapters/rolling-buffer-adapter"
import { VigiNvrPlaybackAdapter } from "../video-adapters/vigi-nvr-playback-adapter"
import type { VideoAdapter } from "../video-adapters/types"

export interface ReplayOrchestratorDeps {
  env: VenueEdgeEnv
  client: EdgeV1Client
  repositories: EdgeRepositories
  paths: LocalStoragePaths
  getEdgeConfig: () => EdgeConfig | null
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
    options: { resumeFrom?: string } = {},
  ): Promise<void> {
    return this.limiter.run(() =>
      this.handleCapture(commandId, payload, options),
    )
  }

  private async handleCapture(
    commandId: string,
    payload: import("../cloud/client.ts").CaptureReplayPayload,
    options: { resumeFrom?: string },
  ): Promise<void> {
    const edgeConfig = this.deps.getEdgeConfig()
    const validation = commandMatchesEdgeAssignment(
      edgeConfig,
      payload.resourceId,
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
      status: "pending",
    })

    if (job.status === "ready") {
      safeLog("info", "Duplicate capture_replay ignored", {
        replayRequestId: payload.replayRequestId,
      })
      return
    }

    if (job.status !== "pending" && job.status !== "failed" && !options.resumeFrom) {
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
      for (let index = startIndex; index < PROGRESS_SEQUENCE.length; index += 1) {
        const status = PROGRESS_SEQUENCE[index]!
        await this.advance(payload, status, commandId)
      }

      await this.deps.client.acknowledgeCommand(commandId, {
        idempotencyKey: `ack-${commandId}`,
        success: true,
        result: { replayRequestId: payload.replayRequestId },
      })

      this.deps.repositories.updateCommandStatus(commandId, "acknowledged", {
        replayRequestId: payload.replayRequestId,
      })
    } catch (error) {
      const failureReason =
        error instanceof Error ? error.message : "capture_failed"
      const lastStatus = this.deps.repositories.getReplayJob(
        payload.replayRequestId,
      )?.status
      const terminalStatus = mapReplayFailureStatus(failureReason, lastStatus)

      safeLog("error", "Replay capture failed", {
        replayRequestId: payload.replayRequestId,
        failureReason,
        lastStatus,
        terminalStatus,
      })

      try {
        await this.deps.client.reportReplayProgress(payload.replayRequestId, {
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
          await this.deps.client.reportReplayProgress(payload.replayRequestId, {
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

      this.deps.repositories.updateCommandStatus(commandId, "failed", {
        reason: failureReason,
      })

      try {
        await this.deps.client.acknowledgeCommand(commandId, {
          idempotencyKey: `fail-${commandId}`,
          success: false,
          result: { reason: failureReason },
        })
      } catch (ackError) {
        safeLog("error", "Failed to acknowledge failed capture command", {
          commandId,
          message:
            ackError instanceof Error ? ackError.message : String(ackError),
        })
      }
    }
  }

  private async advance(
    payload: import("../cloud/client.ts").CaptureReplayPayload,
    status: (typeof PROGRESS_SEQUENCE)[number],
    commandId: string,
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
    })

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
  ): Promise<void> {
    try {
      await this.deps.client.reportReplayProgress(replayRequestId, {
        status,
        ...(extras?.checksumSha256
          ? { checksumSha256: extras.checksumSha256 }
          : {}),
        ...(extras?.sizeBytes ? { sizeBytes: extras.sizeBytes } : {}),
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (message.includes("INVALID_REPLAY_REQUEST_TRANSITION") || message.includes("Cannot transition")) {
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

  private async extractClip(
    payload: import("../cloud/client.ts").CaptureReplayPayload,
  ): Promise<void> {
    const edgeConfig = this.deps.getEdgeConfig()
    const camera = resolveCameraSource(this.deps.env, edgeConfig)
    const simulate = this.deps.env.mode === "simulate"

    if (simulate) {
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
        { simulate },
      ),
      new VigiNvrPlaybackAdapter(camera.rtspUrl),
      new LiveRtspClipAdapter(camera.rtspUrl),
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
        lastError =
          error instanceof Error ? error : new Error(String(error))
        safeLog("warn", "Clip adapter failed", {
          adapter: adapter.name,
          message: lastError.message.slice(0, 400),
        })
        if (lastError.message === "buffer_missing") {
          lastError = new Error("extraction_failed")
        }
      }
    }

    throw lastError ?? new Error("extraction_failed")
  }

  private async assertCaptureSourceReady(
    payload: import("../cloud/client.ts").CaptureReplayPayload,
  ): Promise<void> {
    const edgeConfig = this.deps.getEdgeConfig()
    const camera = resolveCameraSource(this.deps.env, edgeConfig)

    if (this.deps.env.mode === "simulate" || camera.rtspUrl) {
      return
    }

    const captureAt = Date.parse(payload.captureAt)
    const windowStart = new Date(
      captureAt - payload.preRollSeconds * 1000,
    ).toISOString()
    const windowEnd = new Date(
      captureAt + payload.postRollSeconds * 1000,
    ).toISOString()
    const segments = this.deps.repositories.listBufferSegmentsForWindow(
      camera.cameraId,
      windowStart,
      windowEnd,
    )

    if (segments.length === 0) {
      throw new Error("buffer_missing")
    }
  }

  private async uploadClip(
    payload: import("../cloud/client.ts").CaptureReplayPayload,
  ): Promise<void> {
    const job = this.deps.repositories.getReplayJob(payload.replayRequestId)
    if (!job?.localClipPath) {
      throw new Error("upload_failed")
    }

    const grant = await renewUploadGrant(
      this.deps.client,
      payload.mediaAssetId,
      job.uploadGrant ?? payload.uploadGrant,
    )

    this.deps.repositories.updateReplayJob(payload.replayRequestId, {
      uploadGrant: grant,
    })

    if (this.deps.env.mode === "simulate") {
      const body = await readFile(job.localClipPath)
      const checksumSha256 = createHash("sha256").update(body).digest("hex")
      this.uploadResults.set(payload.replayRequestId, {
        checksumSha256,
        bytesUploaded: body.byteLength,
        etag: null,
      })
      safeLog("info", "Simulator upload skipped (mock PUT)", {
        replayRequestId: payload.replayRequestId,
        bytes: body.byteLength,
      })
      return
    }

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
  lastStatus?: string,
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

  return "failed"
}
