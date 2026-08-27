import { mkdir } from "node:fs/promises"
import { pathToFileURL } from "node:url"

import { CredentialManager } from "./auth/credential-manager"
import { isDeviceRevokedCloudError } from "./auth/cloud-errors"
import { SourceSupervisorRegistry } from "./buffers/registry"
import { listBufferingSourceIds } from "./cameras/registry"
import { CommandProcessor } from "./commands/processor"
import { EdgeV1Client, type EdgeConfig } from "./cloud/client"
import { EdgeConfigV2Manager } from "./config/apply-v2"
import { loadEnv, type VenueEdgeMode } from "./config/env"
import { SourceHealthEngine } from "./health/engine"
import { HeartbeatLoop } from "./heartbeat/loop"
import { createLocalStoragePaths } from "./local-storage/paths"
import { EdgeRepositories } from "./local-storage/repositories"
import { ReplayOrchestrator } from "./replay/orchestrator"
import { reindexBufferSegmentsFromDisk } from "./recovery/reindex-buffers"
import { resumeUnfinishedJobs } from "./recovery/resume"
import {
  clockOffsetSecondsForSource,
  type SimulatorScenario,
} from "./simulator/scenario"
import { loadSimulatorScenario } from "./simulator/load-scenario"
import { initDatabase } from "./state/sqlite"
import { safeLog } from "./health/metrics"

export interface VenueEdgeRuntime {
  stop(): Promise<void>
}

function resolveStartupResourceId(
  edgeConfigV2: import("./cloud/config-v2").EdgeConfigV2 | null,
  edgeConfig: EdgeConfig | null
): string | null {
  if (edgeConfigV2) {
    return (
      edgeConfigV2.resources.find((entry) => entry.enabled)?.resourceId ?? null
    )
  }

  return edgeConfig?.resourceId ?? null
}

function resolveAppliedConfigVersion(
  appliedV2Version: number | undefined,
  edgeConfig: EdgeConfig | null
): number | undefined {
  return appliedV2Version ?? edgeConfig?.configVersion
}

function shouldRunRollingBuffer(mode: VenueEdgeMode): boolean {
  return mode === "buffer" || mode === "simulate"
}

export async function startVenueEdge(
  modeOverride?: "start" | "simulate"
): Promise<VenueEdgeRuntime> {
  const env = loadEnv({
    mode: modeOverride === "simulate" ? "simulate" : undefined,
  })

  if (modeOverride === "simulate") {
    env.mode = "simulate"
    process.env.VENUE_EDGE_MODE = "simulate"
  }

  const paths = createLocalStoragePaths(env)
  await mkdir(paths.root, { recursive: true })
  await mkdir(paths.buffers, { recursive: true })
  await mkdir(paths.pending, { recursive: true })
  await mkdir(paths.uploaded, { recursive: true })
  await mkdir(paths.failed, { recursive: true })

  const database = initDatabase(env.sqlitePath)
  const repositories = new EdgeRepositories(database.db)

  const credentialManager = CredentialManager.fromEnv({
    dataDir: env.dataDir,
    mode: env.mode,
    secretStoreMode: env.secretStoreMode,
    installationPath: env.installationPath,
    secretBlobPath: env.secretBlobPath,
  })

  await credentialManager.deleteLegacyPlaintextFile(env.credentialsPath)

  let credentials = null
  try {
    credentials = await credentialManager.loadCredentials()
  } catch (error) {
    if (env.mode === "production") {
      throw error
    }

    safeLog("warn", "Protected credential store unavailable", {
      message: error instanceof Error ? error.message : String(error),
    })
  }

  const client = new EdgeV1Client({
    baseUrl: env.cloudBaseUrl,
    deviceId: credentials?.deviceId,
    secret: credentials?.secret,
    agentVersion: env.firmwareVersion,
  })

  let edgeConfig: EdgeConfig | null = null
  const configManager = new EdgeConfigV2Manager(
    repositories,
    client,
    env.bootId
  )

  const getEdgeConfigV2 = () => configManager.getState().edgeConfigV2

  configManager.loadLastKnownGoodFromDisk()

  let simulatorScenario: SimulatorScenario | null = null

  if (env.mode === "simulate") {
    simulatorScenario = await loadSimulatorScenario(env.dataDir)
  }

  const getSimulatorScenario = () => simulatorScenario

  const healthEngine = new SourceHealthEngine(
    repositories,
    getEdgeConfigV2,
    undefined,
    getSimulatorScenario
  )
  healthEngine.syncDisabledFromConfig()

  const edgeConfigV2OnBoot = getEdgeConfigV2()

  if (edgeConfigV2OnBoot && shouldRunRollingBuffer(env.mode)) {
    await reindexBufferSegmentsFromDisk({
      repositories,
      paths,
      sourceIds: listBufferingSourceIds(edgeConfigV2OnBoot),
    })
  }

  const bufferRegistry = new SourceSupervisorRegistry(
    env,
    paths,
    repositories,
    (sourceId) => {
      healthEngine.recordSourceObservation(sourceId, {
        kind: "soft_failure",
        reasonCode: "ffmpeg_exited",
        observedAt: new Date().toISOString(),
      })
    },
    (sourceId) => clockOffsetSecondsForSource(simulatorScenario, sourceId)
  )

  const refreshConfig = async (): Promise<void> => {
    try {
      const v2Result = await configManager.refreshFromCloud({
        activate: async (config, sourcePlan) => {
          if (!shouldRunRollingBuffer(env.mode)) {
            return
          }

          if (!config) {
            await bufferRegistry.stopAll()
            return
          }

          await bufferRegistry.reconcile({
            edgeConfig,
            edgeConfigV2: config,
            sourcePlan,
          })
        },
      })

      if (!getEdgeConfigV2()) {
        try {
          edgeConfig = await client.getConfig()
        } catch (error) {
          if (isDeviceRevokedCloudError(error)) {
            await handleDeviceRevoked()
            return
          }

          safeLog("warn", "Failed to load edge v1 config fallback", {
            message: error instanceof Error ? error.message : String(error),
          })
        }
      }

      if (shouldRunRollingBuffer(env.mode) && !v2Result.applied) {
        await bufferRegistry.reconcile({
          edgeConfig,
          edgeConfigV2: getEdgeConfigV2(),
          sourcePlan: v2Result.sourcePlan,
        })
      }
    } catch (error) {
      if (isDeviceRevokedCloudError(error)) {
        await handleDeviceRevoked()
      }
    }
  }

  let heartbeat: HeartbeatLoop | null = null

  const handleDeviceRevoked = async (): Promise<void> => {
    safeLog("warn", "Wiping local credentials after cloud revocation")
    await credentialManager.wipeAfterRevoke()
    if (heartbeat) {
      heartbeat.stop()
    }
  }

  await refreshConfig()

  if (
    shouldRunRollingBuffer(env.mode) &&
    bufferRegistry.getBufferingSourceCount() === 0
  ) {
    await bufferRegistry.ensureAllBuffering(edgeConfig, getEdgeConfigV2())
  }

  const orchestrator = new ReplayOrchestrator({
    env,
    client,
    repositories,
    paths,
    getEdgeConfig: () => edgeConfig,
    getEdgeConfigV2,
    healthEngine,
    getSimulatorScenario,
  })

  const processor = new CommandProcessor(
    client,
    repositories,
    orchestrator,
    () => edgeConfig,
    getEdgeConfigV2
  )

  const resumed = await resumeUnfinishedJobs({
    repositories,
    orchestrator,
  })

  const edgeConfigV2State = getEdgeConfigV2()
  const resourceId = resolveStartupResourceId(edgeConfigV2State, edgeConfig)

  safeLog("info", "VenueEdge started", {
    mode: env.mode,
    bootId: env.bootId,
    resumedJobs: resumed,
    resourceId,
    bufferingSourceCount: bufferRegistry.getBufferingSourceCount(),
    configVersion: resolveAppliedConfigVersion(
      configManager.getState().appliedConfigVersion,
      edgeConfig
    ),
  })

  const startedAt = Date.now()
  const heartbeatLoop = new HeartbeatLoop({
    env,
    client,
    processor,
    bufferRegistry,
    healthEngine,
    getAppliedConfigVersion: () =>
      resolveAppliedConfigVersion(
        configManager.getState().appliedConfigVersion,
        edgeConfig
      ),
    getCapacityMetrics: () => orchestrator.getCapacityMetrics(),
    startedAt,
    onDeviceRevoked: handleDeviceRevoked,
  })

  heartbeat = heartbeatLoop

  if (credentials?.deviceId && credentials.secret) {
    heartbeatLoop.start()
  } else {
    safeLog("warn", "VenueEdge started without enrolled device credentials")
  }

  const configRefreshTimer = setInterval(() => {
    void refreshConfig()
  }, 60_000)

  return {
    async stop() {
      heartbeatLoop.stop()
      clearInterval(configRefreshTimer)
      await bufferRegistry.stopAll()
      database.close()
    },
  }
}

async function main(): Promise<void> {
  const command = process.argv[2] ?? "start"

  if (command !== "start" && command !== "simulate") {
    console.error("Usage: venue-edge <start|simulate>")
    process.exit(1)
  }

  const runtime = await startVenueEdge(
    command === "simulate" ? "simulate" : "start"
  )

  const shutdown = async () => {
    await runtime.stop()
    process.exit(0)
  }

  process.on("SIGINT", () => {
    void shutdown()
  })

  process.on("SIGTERM", () => {
    void shutdown()
  })
}

const entrypoint = process.argv[1] ? pathToFileURL(process.argv[1]).href : null

if (entrypoint && import.meta.url === entrypoint) {
  main().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
