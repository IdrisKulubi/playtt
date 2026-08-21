import { randomUUID } from "node:crypto"

export type VenueEdgeMode = "simulate" | "buffer" | "production"

export interface VenueEdgeEnv {
  mode: VenueEdgeMode
  cloudBaseUrl: string
  dataDir: string
  rtspUrl: string | null
  heartbeatIntervalMs: number
  commandPollIntervalMs: number
  credentialsPath: string
  sqlitePath: string
  bootId: string
  firmwareVersion: string
  maxConcurrentReplays: number
  encryptCredentials: boolean
}

function parseMode(value: string | undefined): VenueEdgeMode {
  if (value === "simulate" || value === "buffer" || value === "production") {
    return value
  }

  return "simulate"
}

export function loadEnv(overrides: Partial<VenueEdgeEnv> = {}): VenueEdgeEnv {
  const dataDir =
    overrides.dataDir ?? process.env.VENUE_EDGE_DATA_DIR ?? ".venue-edge-data"

  return {
    mode: overrides.mode ?? parseMode(process.env.VENUE_EDGE_MODE),
    cloudBaseUrl:
      overrides.cloudBaseUrl ??
      process.env.VENUE_EDGE_CLOUD_BASE_URL ??
      process.env.CLOUD_BASE_URL ??
      "http://localhost:3000",
    dataDir,
    rtspUrl: overrides.rtspUrl ?? process.env.RTSP_URL ?? null,
    heartbeatIntervalMs: Number(
      overrides.heartbeatIntervalMs ??
        process.env.VENUE_EDGE_HEARTBEAT_MS ??
        15_000,
    ),
    commandPollIntervalMs: Number(
      overrides.commandPollIntervalMs ??
        process.env.VENUE_EDGE_COMMAND_POLL_MS ??
        5_000,
    ),
    credentialsPath:
      overrides.credentialsPath ??
      process.env.VENUE_EDGE_CREDENTIALS_PATH ??
      `${dataDir}/credentials.json`,
    sqlitePath:
      overrides.sqlitePath ??
      process.env.VENUE_EDGE_SQLITE_PATH ??
      `${dataDir}/venue-edge.sqlite`,
    bootId: overrides.bootId ?? process.env.VENUE_EDGE_BOOT_ID ?? randomUUID(),
    firmwareVersion:
      overrides.firmwareVersion ??
      process.env.VENUE_EDGE_FIRMWARE_VERSION ??
      "0.1.0",
    maxConcurrentReplays: Number(
      overrides.maxConcurrentReplays ??
        process.env.VENUE_EDGE_MAX_CONCURRENT ??
        3,
    ),
    encryptCredentials:
      overrides.encryptCredentials ??
      process.env.VENUE_EDGE_ENCRYPT_CREDENTIALS === "true",
  }
}
