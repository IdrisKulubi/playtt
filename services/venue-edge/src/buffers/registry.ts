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

export class SourceSupervisorRegistry {
  private readonly supervisors = new Map<string, RollingBufferSupervisor>()

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

    for (const camera of cameras) {
      if (!this.supervisors.has(camera.cameraId)) {
        await this.tryStartCamera(camera)
      }
    }
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

    await supervisor.start()
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
    for (const sourceId of [...this.supervisors.keys()]) {
      await this.stopSource(sourceId)
    }
  }
}
