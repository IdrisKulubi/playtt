import type { EdgeConfig } from "../cloud/client"
import type { EdgeConfigV2 } from "../cloud/config-v2"
import { getCamera, listBufferingCameras } from "../cameras/registry"
import type { VenueEdgeEnv } from "../config/env"
import { evaluateBufferStartBudget } from "../config/budgets"
import type { SourcePlan } from "../config/source-plan"
import { RollingBufferSupervisor } from "./rolling-buffer"
import type { EdgeRepositories } from "../local-storage/repositories"
import type { LocalStoragePaths } from "../local-storage/paths"
import { safeLog } from "../health/metrics"

/** No new segment for this long while "running" means ffmpeg is stuck. */
export const BUFFER_STALL_MS = 45_000
export const BUFFER_RESTART_MIN_MS = 10_000
export const BUFFER_RESTART_MAX_MS = 120_000
const WATCHDOG_INTERVAL_MS = 15_000

type BufferConfigs = { edgeConfig: EdgeConfig | null; edgeConfigV2: EdgeConfigV2 | null }

export class SourceSupervisorRegistry {
  private readonly supervisors = new Map<string, RollingBufferSupervisor>()
  /** Per source: when the next restart may happen, and the current back-off. */
  private readonly restartBackoff = new Map<string, { notBefore: number; delayMs: number }>()
  private watchdogTimer: NodeJS.Timeout | null = null

  constructor(
    private readonly env: VenueEdgeEnv,
    private readonly paths: LocalStoragePaths,
    private readonly repositories: EdgeRepositories,
    private readonly onFfmpegExited?: (sourceId: string) => void,
    private readonly getClockOffsetSeconds?: (sourceId: string) => number
  ) {}

  getSupervisor(sourceId: string): RollingBufferSupervisor | undefined {
    return this.supervisors.get(sourceId)
  }

  getRunningCount(): number {
    return [...this.supervisors.values()].filter((supervisor) =>
      supervisor.isRunning()
    ).length
  }

  getBufferingSourceCount(): number {
    return this.supervisors.size
  }

  isAnyRunning(): boolean {
    return this.getRunningCount() > 0
  }

  async reconcile(input: {
    edgeConfig: EdgeConfig | null
    edgeConfigV2: EdgeConfigV2 | null
    sourcePlan: SourcePlan | null
  }): Promise<void> {
    const { edgeConfig, edgeConfigV2, sourcePlan } = input

    if (!sourcePlan) {
      await this.ensureAllBuffering(edgeConfig, edgeConfigV2)
      return
    }

    for (const entry of sourcePlan.entries) {
      if (entry.action === "unchanged") {
        continue
      }

      if (entry.action === "disable" || entry.action === "remove") {
        await this.stopSource(entry.sourceId)
        continue
      }

      if (entry.action === "update") {
        await this.stopSource(entry.sourceId)
        if (sourcePlan.bufferingSourceIds.includes(entry.sourceId)) {
          await this.tryStartSource(entry.sourceId, edgeConfig, edgeConfigV2)
        }
        continue
      }

      if (entry.action === "add") {
        await this.tryStartSource(entry.sourceId, edgeConfig, edgeConfigV2)
      }
    }

    await this.ensureAllBuffering(edgeConfig, edgeConfigV2)
  }

  async ensureAllBuffering(
    edgeConfig: EdgeConfig | null,
    edgeConfigV2: EdgeConfigV2 | null
  ): Promise<void> {
    const cameras = listBufferingCameras(this.env, edgeConfig, edgeConfigV2)

    const now = Date.now()
    for (const camera of cameras) {
      // A supervisor whose ffmpeg exited stays in the map; restart it too.
      if (this.supervisors.get(camera.cameraId)?.isRunning()) continue
      const backoff = this.restartBackoff.get(camera.cameraId)
      if (backoff && backoff.notBefore > now) continue
      await this.tryStartCamera(camera)
    }
  }

  /**
   * One watchdog pass: restarts buffers that stalled (connected but no video,
   * e.g. the recorder was switched off) or whose ffmpeg exited, backing off
   * from 10 s to 2 min per source so a recorder that stays off isn't hammered.
   */
  async superviseOnce(configs: BufferConfigs, now = Date.now()): Promise<void> {
    for (const [sourceId, supervisor] of this.supervisors) {
      const stalled = supervisor.isStalled(now, BUFFER_STALL_MS)
      const exited = !supervisor.isRunning()

      if (!stalled && !exited) {
        // Saving video again: forget earlier failures.
        if (now - supervisor.getLastProgressAt() < BUFFER_STALL_MS) this.restartBackoff.delete(sourceId)
        continue
      }

      if (stalled) {
        safeLog("warn", "Buffer stalled; restarting FFmpeg", {
          sourceId,
          secondsWithoutVideo: Math.round((now - supervisor.getLastProgressAt()) / 1000),
          action: "Check the recorder (NVR) is switched on and reachable from this PC.",
        })
        await this.stopSource(sourceId)
      }

      if (!this.restartBackoff.has(sourceId) || this.restartBackoff.get(sourceId)!.notBefore <= now) {
        const previous = this.restartBackoff.get(sourceId)?.delayMs ?? 0
        const delayMs = Math.min(BUFFER_RESTART_MAX_MS, previous ? previous * 2 : BUFFER_RESTART_MIN_MS)
        this.restartBackoff.set(sourceId, { notBefore: now + delayMs, delayMs })
      }
    }

    await this.ensureAllBuffering(configs.edgeConfig, configs.edgeConfigV2)
  }

  /** Runs `superviseOnce` every 15 s while `shouldRun()` is true. */
  startWatchdog(getConfigs: () => BufferConfigs, shouldRun: () => boolean = () => true): void {
    if (this.watchdogTimer) return
    this.watchdogTimer = setInterval(() => {
      if (!shouldRun()) return
      void this.superviseOnce(getConfigs()).catch((error) => {
        safeLog("warn", "Buffer watchdog pass failed", {
          message: error instanceof Error ? error.message : String(error),
        })
      })
    }, WATCHDOG_INTERVAL_MS)
    this.watchdogTimer.unref?.()
  }

  async tryStartSource(
    sourceId: string,
    edgeConfig: EdgeConfig | null,
    edgeConfigV2: EdgeConfigV2 | null
  ): Promise<void> {
    const camera = getCamera(this.env, edgeConfig, edgeConfigV2, sourceId)

    if (!camera) {
      return
    }

    await this.tryStartCamera(camera)
  }

  private async tryStartCamera(
    camera: import("../cameras/source").CameraSourceConfig
  ): Promise<void> {
    const existing = this.supervisors.get(camera.cameraId)
    if (existing?.isRunning()) {
      return
    }
    if (existing) {
      await existing.stop()
      this.supervisors.delete(camera.cameraId)
    }

    const budget = await evaluateBufferStartBudget(
      this.env,
      this.getRunningCount()
    )

    if (!budget.allowed) {
      safeLog("info", "Deferred buffer supervisor start", {
        sourceId: camera.cameraId,
        resourceId: camera.resourceId ?? null,
        reason: budget.reason,
      })
      return
    }

    const supervisor = new RollingBufferSupervisor(
      camera,
      this.paths,
      this.repositories,
      {
        simulate: this.env.mode === "simulate",
        maxDiskBytes: this.env.perSourceBufferDiskBytes,
        clockOffsetSeconds: this.getClockOffsetSeconds?.(camera.cameraId) ?? 0,
        onFfmpegExited: this.onFfmpegExited,
      }
    )

    try {
      await supervisor.start()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (message.startsWith("SOURCE_RTSP_URL_MISSING:")) {
        safeLog("warn", "Deferred buffer supervisor until camera credentials are available", {
          sourceId: camera.cameraId,
          resourceId: camera.resourceId ?? null,
          reason: "source_rtsp_url_missing",
          action: "Open VenueEdge setup and re-enter the NVR password.",
        })
        return
      }

      throw error
    }
    this.supervisors.set(camera.cameraId, supervisor)

    safeLog("info", "Buffer supervisor started", {
      sourceId: camera.cameraId,
      resourceId: camera.resourceId ?? null,
    })
  }

  private async stopSource(sourceId: string): Promise<void> {
    const supervisor = this.supervisors.get(sourceId)
    if (!supervisor) {
      return
    }

    await supervisor.stop()
    this.supervisors.delete(sourceId)

    safeLog("info", "Buffer supervisor stopped", {
      sourceId,
    })
  }

  async stopAll(): Promise<void> {
    if (this.watchdogTimer) {
      clearInterval(this.watchdogTimer)
      this.watchdogTimer = null
    }
    for (const sourceId of [...this.supervisors.keys()]) {
      await this.stopSource(sourceId)
    }
  }
}
