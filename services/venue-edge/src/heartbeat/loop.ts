import type { EdgeV1Client, EdgeConfig } from "../cloud/client"
import type { VenueEdgeEnv } from "../config/env"
import { createMetricsSnapshot, safeLog } from "../health/metrics"
import type { CommandProcessor } from "../commands/processor"
import type { RollingBufferSupervisor } from "../buffers/rolling-buffer"

export interface HeartbeatLoopDeps {
  env: VenueEdgeEnv
  client: EdgeV1Client
  processor: CommandProcessor
  rollingBuffer?: RollingBufferSupervisor | null
  getEdgeConfig: () => EdgeConfig | null
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
      void this.deps.processor.pollAndProcess()
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
    const edgeConfig = this.deps.getEdgeConfig()
    const metrics = createMetricsSnapshot({
      ffmpegRunning: this.deps.rollingBuffer?.isRunning() ?? false,
      bufferAgeSeconds: null,
      uploadQueueDepth: 0,
      activeReplayJobs: 0,
    })

    try {
      const response = await this.deps.client.heartbeat({
        bootId: this.deps.env.bootId,
        firmwareVersion: this.deps.env.firmwareVersion,
        uptimeMs: Date.now() - this.deps.startedAt,
        appliedConfigVersion: edgeConfig?.configVersion,
        metrics: metrics as unknown as Record<string, unknown>,
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
