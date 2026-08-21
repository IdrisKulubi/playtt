import { mkdir } from "node:fs/promises"
import { pathToFileURL } from "node:url"

import { loadCredentials } from "./auth/credentials"
import { resolveCameraSource } from "./cameras/source"
import { RollingBufferSupervisor } from "./buffers/rolling-buffer"
import { CommandProcessor } from "./commands/processor"
import { EdgeV1Client, type EdgeConfig } from "./cloud/client"
import { loadEnv } from "./config/env"
import { HeartbeatLoop } from "./heartbeat/loop"
import { createLocalStoragePaths } from "./local-storage/paths"
import { EdgeRepositories } from "./local-storage/repositories"
import { ReplayOrchestrator } from "./replay/orchestrator"
import { resumeUnfinishedJobs } from "./recovery/resume"
import { initDatabase } from "./state/sqlite"
import { safeLog } from "./health/metrics"

export interface VenueEdgeRuntime {
  stop(): Promise<void>
}

export async function startVenueEdge(
  modeOverride?: "start" | "simulate",
): Promise<VenueEdgeRuntime> {
  const env = loadEnv({
    mode:
      modeOverride === "simulate" ? "simulate" : undefined,
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

  const credentials = await loadCredentials(env.credentialsPath, {
    encrypt: env.encryptCredentials,
  })

  const client = new EdgeV1Client({
    baseUrl: env.cloudBaseUrl,
    deviceId: credentials?.deviceId,
    secret: credentials?.secret,
  })

  let edgeConfig: EdgeConfig | null = null

  const refreshConfig = async (): Promise<EdgeConfig | null> => {
    try {
      edgeConfig = await client.getConfig()
      return edgeConfig
    } catch (error) {
      safeLog("warn", "Failed to load edge config", {
        message: error instanceof Error ? error.message : String(error),
      })
      return edgeConfig
    }
  }

  await refreshConfig()

  const orchestrator = new ReplayOrchestrator({
    env,
    client,
    repositories,
    paths,
    getEdgeConfig: () => edgeConfig,
  })

  const processor = new CommandProcessor(
    client,
    repositories,
    orchestrator,
    () => edgeConfig,
  )

  const camera = resolveCameraSource(env, edgeConfig)
  const rollingBuffer =
    env.mode === "buffer"
      ? new RollingBufferSupervisor(camera, paths, repositories, {
          simulate: false,
        })
      : env.mode === "simulate"
        ? new RollingBufferSupervisor(camera, paths, repositories, {
            simulate: true,
          })
        : null

  if (rollingBuffer) {
    await rollingBuffer.start()
  }

  const resumed = await resumeUnfinishedJobs({
    repositories,
    orchestrator,
  })

  safeLog("info", "VenueEdge started", {
    mode: env.mode,
    bootId: env.bootId,
    resumedJobs: resumed,
    resourceId: (edgeConfig as EdgeConfig | null)?.resourceId ?? null,
  })

  const startedAt = Date.now()
  const heartbeat = new HeartbeatLoop({
    env,
    client,
    processor,
    rollingBuffer,
    getEdgeConfig: () => edgeConfig,
    startedAt,
  })

  heartbeat.start()

  const configRefreshTimer = setInterval(() => {
    void refreshConfig()
  }, 60_000)

  return {
    async stop() {
      heartbeat.stop()
      clearInterval(configRefreshTimer)
      await rollingBuffer?.stop()
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
    command === "simulate" ? "simulate" : "start",
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

const entrypoint = process.argv[1]
  ? pathToFileURL(process.argv[1]).href
  : null

if (entrypoint && import.meta.url === entrypoint) {
  main().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
