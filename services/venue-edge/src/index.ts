import { mkdir } from "node:fs/promises"
import { pathToFileURL } from "node:url"

import { CredentialManager } from "./auth/credential-manager"
import type { VenueEdgeEnv } from "./config/env"
import { createNvrPasswordStore } from "./auth/nvr-secret-store"
import { isDeviceRevokedCloudError } from "./auth/cloud-errors"
import {
  confirmPendingEnrollment,
  enrollVenueEdge,
} from "./enrollment/enroll"
import { SourceSupervisorRegistry } from "./buffers/registry"
import { listBufferingSourceIds } from "./cameras/registry"
import { CommandProcessor } from "./commands/processor"
import { EdgeV1Client, type EdgeConfig } from "./cloud/client"
import { parseEdgeConfigV2 } from "./cloud/config-v2"
import { EdgeConfigV2Manager } from "./config/apply-v2"
import { buildSourcePlan } from "./config/source-plan"
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
import { startSetupHost, type SetupHostDiagnosticsContext, type SetupHostHandle } from "./setup/host"
import { LocalNvrManager } from "./setup/local-nvr-manager"
import { LocalCameraManager } from "./setup/local-camera-manager"
import { TopologyReviewManager } from "./setup/topology-review-manager"
import { LocalResourceMappingManager } from "./setup/local-resource-mapping-manager"
import { CommissioningManager } from "./setup/commissioning-manager"
import { resolveRuntimeEdgeConfigV2 } from "./setup/local-config-overlay"
import { VenueEdgeUpdater } from "./update/updater"
import {
  probeVenueEdgeHealth,
  restartInstalledVenueEdgeService,
} from "./update/service-control"

export interface VenueEdgeRuntime {
  stop(): Promise<void>
  setupHost: SetupHostHandle | null
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

function resolveHeartbeatAssignmentVersion(
  edgeConfig: EdgeConfig | null
): number | undefined {
  return edgeConfig?.configVersion
}

function shouldRunRollingBuffer(
  mode: VenueEdgeMode,
  commissioned: boolean,
): boolean {
  if (mode === "simulate" || mode === "buffer") {
    return true
  }

  if (mode === "production") {
    return commissioned
  }

  return false
}

function isProductionCaptureAllowed(
  mode: VenueEdgeMode,
  commissioned: boolean,
): boolean {
  if (mode !== "production") {
    return true
  }

  return commissioned
}

function buildSetupHostDiagnostics(input: {
  env: VenueEdgeEnv
  credentialManager: CredentialManager
  healthEngine?: SourceHealthEngine | null
  getRecentFailureCodes?: () => string[]
}): SetupHostDiagnosticsContext {
  return {
    env: input.env,
    currentVersion: input.env.firmwareVersion,
    platform: process.platform,
    architecture: process.arch,
    healthEngine: input.healthEngine ?? null,
    getRecentFailureCodes: input.getRecentFailureCodes,
    resolveInstallationId: async () => {
      const metadata = await input.credentialManager.loadInstallationMetadata()
      if (metadata?.installationUid) {
        return metadata.installationUid
      }

      const credentials = await input.credentialManager.loadCredentials()
      return credentials?.deviceId ?? null
    },
  }
}

export async function startVenueEdge(
  modeOverride?: "start" | "simulate"
): Promise<VenueEdgeRuntime> {
  const mode =
    modeOverride === "simulate"
      ? "simulate"
      : modeOverride === "start" && !process.env.VENUE_EDGE_MODE
        ? "buffer"
        : undefined
  const env = loadEnv({
    mode,
  })

  if (modeOverride === "simulate") {
    env.mode = "simulate"
    process.env.VENUE_EDGE_MODE = "simulate"
  } else if (modeOverride === "start" && mode === "buffer") {
    process.env.VENUE_EDGE_MODE = "buffer"
  }

  const paths = createLocalStoragePaths(env)
  await mkdir(paths.root, { recursive: true })
  await mkdir(paths.buffers, { recursive: true })
  await mkdir(paths.pending, { recursive: true })
  await mkdir(paths.uploaded, { recursive: true })
  await mkdir(paths.failed, { recursive: true })

  const database = initDatabase(env.sqlitePath)
  const repositories = new EdgeRepositories(database.db)

  if (
    env.mode === "simulate" &&
    repositories.listLocalCameras().some((camera) => camera.enabled)
  ) {
    safeLog("warn", "Simulator mode is active; configured cameras will not be captured", {
      mode: env.mode,
      enabledCameraCount: repositories
        .listLocalCameras()
        .filter((camera) => camera.enabled).length,
      action: "Run pnpm start without VENUE_EDGE_MODE=simulate to capture real video.",
    })
  }

  const nvrPasswordStore = createNvrPasswordStore({
    dataDir: env.dataDir,
    secretStoreMode: env.secretStoreMode,
    venueMode: env.mode,
  })
  const localNvrManager = new LocalNvrManager(repositories, nvrPasswordStore)
  const localCameraManager = new LocalCameraManager(
    repositories,
    nvrPasswordStore,
    localNvrManager,
  )
  const topologyReviewManager = new TopologyReviewManager(
    repositories,
    localNvrManager,
    localCameraManager,
  )

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

  if (!credentials && env.pairingCode) {
    const enrolled = await enrollVenueEdge({
      pairingCode: env.pairingCode,
      credentialManager,
      client,
      agentVersion: env.firmwareVersion,
      bootId: env.bootId,
    })
    credentials = await credentialManager.loadCredentials()
    safeLog("info", "Paired with PlayTT venue", {
      deviceId: enrolled.deviceId,
      installationId: enrolled.installationId,
      status: enrolled.status,
    })
  }

  let edgeConfig: EdgeConfig | null = null
  const configManager = new EdgeConfigV2Manager(
    repositories,
    client,
    env.bootId
  )

  let runtimeEdgeConfigV2: import("./cloud/config-v2").EdgeConfigV2 | null = null

  const buildRuntimeEdgeConfigV2 = (
    baseConfig: import("./cloud/config-v2").EdgeConfigV2 | null,
  ): import("./cloud/config-v2").EdgeConfigV2 | null =>
    resolveRuntimeEdgeConfigV2(repositories, baseConfig)

  const getEdgeConfigV2 = () => runtimeEdgeConfigV2

  const applyRuntimeSourceRtspUrls = async (
    config: import("./cloud/config-v2").EdgeConfigV2 | null,
  ): Promise<void> => {
    if (Object.keys(env.sourceRtspUrls).length > 0) {
      return
    }

    env.runtimeSourceRtspUrls =
      await localCameraManager.buildRuntimeSourceRtspMap(config)
  }

  const refreshRuntimeSourceRtspUrls = async (): Promise<void> =>
    applyRuntimeSourceRtspUrls(getEdgeConfigV2())

  runtimeEdgeConfigV2 = buildRuntimeEdgeConfigV2(
    configManager.loadLastKnownGoodFromDisk(),
  )

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

  const getCommissioningCompleted = (): boolean =>
    repositories.getCommissioningState().completed

  const edgeConfigV2OnBoot = getEdgeConfigV2()

  if (
    edgeConfigV2OnBoot &&
    shouldRunRollingBuffer(env.mode, getCommissioningCompleted())
  ) {
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

  const activateRuntimeConfig = async (
    baseConfig: import("./cloud/config-v2").EdgeConfigV2 | null,
  ): Promise<void> => {
    const nextRuntimeConfig = buildRuntimeEdgeConfigV2(baseConfig)

    if (!shouldRunRollingBuffer(env.mode, getCommissioningCompleted())) {
      await bufferRegistry.stopAll()
      runtimeEdgeConfigV2 = nextRuntimeConfig
      return
    }

    if (!nextRuntimeConfig) {
      await bufferRegistry.stopAll()
      runtimeEdgeConfigV2 = null
      return
    }

    await applyRuntimeSourceRtspUrls(nextRuntimeConfig)
    const runtimeSourcePlan = buildSourcePlan(
      runtimeEdgeConfigV2,
      nextRuntimeConfig,
    )
    await bufferRegistry.reconcile({
      edgeConfig,
      edgeConfigV2: nextRuntimeConfig,
      sourcePlan: runtimeSourcePlan,
    })
    runtimeEdgeConfigV2 = nextRuntimeConfig
  }

  const refreshConfig = async (): Promise<void> => {
    try {
      const v2Result = await configManager.refreshFromCloud({
        activate: async (config) => activateRuntimeConfig(config),
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

      if (!v2Result.applied) {
        await activateRuntimeConfig(configManager.getState().edgeConfigV2)
      }

      await refreshRuntimeSourceRtspUrls()
    } catch (error) {
      if (isDeviceRevokedCloudError(error)) {
        await handleDeviceRevoked()
      }
    }
  }

  let heartbeat: HeartbeatLoop | null = null

  const handleDeviceRevoked = async (): Promise<void> => {
    safeLog("warn", "Cloud identity removed; returning setup to pairing")
    await credentialManager.wipeAfterRevoke()
    repositories.invalidateCommissioning()
    configManager.resetLocalConfigCache()
    client.clearCredentials()
    credentials = null
    await activateRuntimeConfig(null)
    if (heartbeat) {
      heartbeat.stop()
    }
  }

  await refreshConfig()

  if (
    shouldRunRollingBuffer(env.mode, getCommissioningCompleted()) &&
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
    getEdgeConfigV2,
    () => isProductionCaptureAllowed(env.mode, getCommissioningCompleted()),
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
    assignmentConfigVersion: resolveHeartbeatAssignmentVersion(edgeConfig),
    configRevision: configManager.getState().appliedConfigVersion,
  })

  const startedAt = Date.now()
  const updater = new VenueEdgeUpdater({
    client,
    dataDir: env.dataDir,
    currentVersion: env.firmwareVersion,
    platform: process.platform,
    architecture: process.arch,
    publicKeyPem: process.env.VENUE_EDGE_UPDATE_PUBLIC_KEY?.trim() ?? null,
    restartService: restartInstalledVenueEdgeService,
    healthCheck: probeVenueEdgeHealth,
  })

  const heartbeatLoop = new HeartbeatLoop({
    env,
    client,
    processor,
    bufferRegistry,
    healthEngine,
    getAppliedConfigVersion: () =>
      resolveHeartbeatAssignmentVersion(edgeConfig),
    getCapacityMetrics: () => orchestrator.getCapacityMetrics(),
    startedAt,
    onDeviceRevoked: handleDeviceRevoked,
    onHeartbeatOk: async () => {
      await confirmPendingEnrollment(client)
      await updater.pollAndApply()
    },
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

  const localResourceMappingManager = new LocalResourceMappingManager(
    repositories,
    getEdgeConfigV2,
  )

  const commissioningManager = new CommissioningManager(
    repositories,
    nvrPasswordStore,
    localCameraManager,
    paths,
    credentialManager,
    getEdgeConfigV2,
    client,
  )

  let setupHost: SetupHostHandle | null = null
  if (env.setupOnStart) {
    setupHost = await startSetupHost({
      port: env.setupPort,
      sessionTtlMs: env.setupSessionTtlMs,
      credentialManager,
      dataDir: env.dataDir,
      localNvrManager,
      localCameraManager,
      topologyReviewManager,
      localResourceMappingManager,
      commissioningManager,
      diagnostics: buildSetupHostDiagnostics({
        env,
        credentialManager,
        healthEngine,
      }),
      resetConfigCache: async () => {
        configManager.resetLocalConfigCache()
      },
      onConfigurationChanged: async () => {
        await activateRuntimeConfig(configManager.getState().edgeConfigV2)
        await refreshRuntimeSourceRtspUrls()
      },
      refreshConfiguration: refreshConfig,
      cloudDashboardUrl: new URL("/nvr", env.cloudBaseUrl).toString(),
      enroll: async (pairingCode) => {
        const enrolled = await enrollVenueEdge({
          pairingCode,
          credentialManager,
          client,
          agentVersion: env.firmwareVersion,
          bootId: env.bootId,
        })
        configManager.resetLocalConfigCache()
        credentials = await credentialManager.loadCredentials()
        heartbeatLoop.start()
        await refreshConfig()
        return enrolled
      },
    })
    console.log(`VenueEdge setup: open ${setupHost.setupUrl}`)
  }

  return {
    setupHost,
    async stop() {
      heartbeatLoop.stop()
      clearInterval(configRefreshTimer)
      if (setupHost) {
        await setupHost.stop()
      }
      await bufferRegistry.stopAll()
      database.close()
    },
  }
}

async function runSetupOnly(): Promise<void> {
  const env = loadEnv()
  const database = initDatabase(env.sqlitePath)
  const repositories = new EdgeRepositories(database.db)
  const credentialManager = CredentialManager.fromEnv(env)
  await credentialManager.deleteLegacyPlaintextFile(env.credentialsPath)
  const credentials = await credentialManager.loadCredentials()
  const client = new EdgeV1Client({
    baseUrl: env.cloudBaseUrl,
    deviceId: credentials?.deviceId,
    secret: credentials?.secret,
    agentVersion: env.firmwareVersion,
  })

  const nvrPasswordStore = createNvrPasswordStore({
    dataDir: env.dataDir,
    secretStoreMode: env.secretStoreMode,
    venueMode: env.mode,
  })
  const localNvrManager = new LocalNvrManager(repositories, nvrPasswordStore)
  const localCameraManager = new LocalCameraManager(
    repositories,
    nvrPasswordStore,
    localNvrManager,
  )
  const topologyReviewManager = new TopologyReviewManager(
    repositories,
    localNvrManager,
    localCameraManager,
  )

  const loadEdgeConfigV2 = () => {
    const current = repositories.getCurrentConfig()
    if (!current) {
      return null
    }

    try {
      return parseEdgeConfigV2(current.snapshot)
    } catch {
      return null
    }
  }

  const localResourceMappingManager = new LocalResourceMappingManager(
    repositories,
    loadEdgeConfigV2,
  )

  const paths = createLocalStoragePaths(env)
  const commissioningManager = new CommissioningManager(
    repositories,
    nvrPasswordStore,
    localCameraManager,
    paths,
    credentialManager,
    loadEdgeConfigV2,
    client,
  )

  const setupHost = await startSetupHost({
    port: env.setupPort,
    sessionTtlMs: env.setupSessionTtlMs,
    credentialManager,
    dataDir: env.dataDir,
    localNvrManager,
    localCameraManager,
    topologyReviewManager,
    localResourceMappingManager,
    commissioningManager,
    diagnostics: buildSetupHostDiagnostics({
      env,
      credentialManager,
    }),
    resetConfigCache: () => repositories.clearConfigSnapshots(),
    enroll: async (pairingCode) => {
      const enrolled = await enrollVenueEdge({
        pairingCode,
        credentialManager,
        client,
        agentVersion: env.firmwareVersion,
        bootId: env.bootId,
      })
      repositories.clearConfigSnapshots()
      return enrolled
    },
  })

  console.log(`VenueEdge setup: open ${setupHost.setupUrl}`)

  const shutdown = async () => {
    await setupHost.stop()
    database.close()
    process.exit(0)
  }

  process.on("SIGINT", () => {
    void shutdown()
  })

  process.on("SIGTERM", () => {
    void shutdown()
  })
}

async function main(): Promise<void> {
  const command = process.argv[2] ?? "start"

  if (command === "setup") {
    await runSetupOnly()
    return
  }

  if (command === "enroll") {
    const pairingCode = process.argv[3] ?? process.env.VENUE_EDGE_PAIRING_CODE
    if (!pairingCode) {
      console.error("Usage: venue-edge enroll <pairing-code>")
      process.exit(1)
    }

    const env = loadEnv({ pairingCode })
    const credentialManager = CredentialManager.fromEnv(env)
    await credentialManager.deleteLegacyPlaintextFile(env.credentialsPath)
    const client = new EdgeV1Client({
      baseUrl: env.cloudBaseUrl,
      agentVersion: env.firmwareVersion,
    })
    const enrolled = await enrollVenueEdge({
      pairingCode,
      credentialManager,
      client,
      agentVersion: env.firmwareVersion,
      bootId: env.bootId,
    })
    safeLog("info", "Enrollment finished", {
      deviceId: enrolled.deviceId,
      installationId: enrolled.installationId,
      status: enrolled.status,
    })
    return
  }

  if (command !== "start" && command !== "simulate") {
    console.error("Usage: venue-edge <start|simulate|enroll|setup>")
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
