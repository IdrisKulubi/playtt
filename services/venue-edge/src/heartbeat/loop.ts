import type { EdgeV1Client } from "../cloud/client"
import type { VenueEdgeEnv } from "../config/env"
import { createMetricsSnapshot, safeLog } from "../health/metrics"
import type { CommandProcessor } from "../commands/processor"
import type { SourceSupervisorRegistry } from "../buffers/registry"
import type { SourceHealthEngine } from "../health/engine"

export interface HeartbeatLoopDeps {
  env: VenueEdgeEnv
  client: EdgeV1Client
  processor: CommandProcessor
  bufferRegistry?: SourceSupervisorRegistry | null
  healthEngine?: SourceHealthEngine | null
  getAppliedConfigVersion?: () => number | undefined
  getCapacityMetrics?: () => {
    activeReplayJobs: number
    replayQueueDepth: number
    maxConcurrentReplays: number
  }
  startedAt: number
}

export class HeartbeatLoop {
  private timer: NodeJS.Timeout | null = null
  private commandTimer: NodeJS.Timeout | null = null

  constructor(private readonly deps: HeartbeatLoopDeps) {}

  start(): void {
    void this.tick()
    this.timer = setInterval(() => {
      void this.tick()
    }, this.deps.env.heartbeatIntervalMs)

    this.commandTimer = setInterval(() => {
      void this.deps.processor.pollAndProcess().catch((error) => {
        safeLog("error", "Command poll failed", {
          message: error instanceof Error ? error.message : String(error),
        })
      })
    }, this.deps.env.commandPollIntervalMs)
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }

    if (this.commandTimer) {
      clearInterval(this.commandTimer)
      this.commandTimer = null
    }
  }

  private async tick(): Promise<void> {
    if (this.deps.healthEngine) {
      await this.deps.healthEngine.tick()
    }

    const capacity = this.deps.getCapacityMetrics?.() ?? {
      activeReplayJobs: 0,
      replayQueueDepth: 0,
      maxConcurrentReplays: this.deps.env.maxConcurrentReplays,
    }
    const registry = this.deps.bufferRegistry
    const metrics = createMetricsSnapshot({
      ffmpegRunning: registry?.isAnyRunning() ?? false,
      bufferingSourceCount: registry?.getBufferingSourceCount() ?? 0,
      ffmpegProcessCount: registry?.getRunningCount() ?? 0,
      bufferAgeSeconds: null,
      uploadQueueDepth: capacity.replayQueueDepth,
      activeReplayJobs: capacity.activeReplayJobs,
      maxConcurrentReplays: capacity.maxConcurrentReplays,
    })

    try {
      const response = await this.deps.client.heartbeat({
        bootId: this.deps.env.bootId,
        firmwareVersion: this.deps.env.firmwareVersion,
        uptimeMs: Date.now() - this.deps.startedAt,
        appliedConfigVersion: this.deps.getAppliedConfigVersion?.(),
        metrics: {
          ...(metrics as unknown as Record<string, unknown>),
          sourceHealth:
            this.deps.healthEngine?.getHeartbeatHealthSnapshot() ?? [],
        },
      })

      safeLog("info", "Heartbeat ok", {
        health: response.health,
        pendingCommandCount: response.pendingCommandCount,
      })

      if (response.pendingCommandCount > 0) {
        await this.deps.processor.pollAndProcess()
      }
    } catch (error) {
      safeLog("warn", "Heartbeat failed", {
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }
}
