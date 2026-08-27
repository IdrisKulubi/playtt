import { randomUUID } from "node:crypto"

export type VenueEdgeMode = "simulate" | "buffer" | "production"

export interface VenueEdgeEnv {
  mode: VenueEdgeMode
  cloudBaseUrl: string
  dataDir: string
  rtspUrl: string | null
  sourceRtspUrls: Readonly<Record<string, string>>
  runtimeSourceRtspUrls: Record<string, string>
  heartbeatIntervalMs: number
  commandPollIntervalMs: number
  credentialsPath: string
  installationPath: string
  secretBlobPath: string
  secretStoreMode: string
  pairingCode: string | null
  setupPort: number
  setupSessionTtlMs: number
  setupOnStart: boolean
  sqlitePath: string
  bootId: string
  firmwareVersion: string
  maxConcurrentReplays: number
  maxBufferProcesses: number
  perSourceBufferDiskBytes: number
  reservedFreeDiskBytes: number
  minFreeMemoryBytes: number
  maxCpuLoadAverage: number
  maxCpuPercent: number
  maxNetworkMbps: number
  estimatedSourceNetworkMbps: number
}

function parseSourceRtspUrls(
  value: string | undefined
): Record<string, string> {
  if (!value) {
    return {}
  }

  try {
    const parsed = JSON.parse(value) as unknown
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {}
    }

    return Object.fromEntries(
      Object.entries(parsed).filter(
        (entry): entry is [string, string] =>
          entry[0].length > 0 &&
          typeof entry[1] === "string" &&
          entry[1].length > 0
      )
    )
  } catch {
    return {}
  }
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
    sourceRtspUrls:
      overrides.sourceRtspUrls ??
      parseSourceRtspUrls(process.env.VENUE_EDGE_SOURCE_RTSP_URLS_JSON),
    runtimeSourceRtspUrls: overrides.runtimeSourceRtspUrls ?? {},
    heartbeatIntervalMs: Number(
      overrides.heartbeatIntervalMs ??
        process.env.VENUE_EDGE_HEARTBEAT_MS ??
        15_000
    ),
    commandPollIntervalMs: Number(
      overrides.commandPollIntervalMs ??
        process.env.VENUE_EDGE_COMMAND_POLL_MS ??
        5_000
    ),
    credentialsPath:
      overrides.credentialsPath ??
      process.env.VENUE_EDGE_CREDENTIALS_PATH ??
      `${dataDir}/credentials.json`,
    installationPath:
      overrides.installationPath ??
      process.env.VENUE_EDGE_INSTALLATION_PATH ??
      `${dataDir}/installation.json`,
    secretBlobPath:
      overrides.secretBlobPath ??
      process.env.VENUE_EDGE_SECRET_BLOB_PATH ??
      `${dataDir}/credentials.dpapi`,
    secretStoreMode:
      overrides.secretStoreMode ??
      process.env.VENUE_EDGE_SECRET_STORE ??
      "",
    pairingCode:
      overrides.pairingCode ?? process.env.VENUE_EDGE_PAIRING_CODE ?? null,
    setupPort: Number(
      overrides.setupPort ?? process.env.VENUE_EDGE_SETUP_PORT ?? 18_764,
    ),
    setupSessionTtlMs: Number(
      overrides.setupSessionTtlMs ??
        process.env.VENUE_EDGE_SETUP_SESSION_TTL_MS ??
        15 * 60 * 1000,
    ),
    setupOnStart:
      overrides.setupOnStart ??
      (process.env.VENUE_EDGE_SETUP_ON_START === undefined
        ? true
        : process.env.VENUE_EDGE_SETUP_ON_START === "true"),
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
        3
    ),
    maxBufferProcesses: Number(
      overrides.maxBufferProcesses ??
        process.env.VENUE_EDGE_MAX_BUFFER_PROCESSES ??
        8
    ),
    perSourceBufferDiskBytes: Number(
      overrides.perSourceBufferDiskBytes ??
        process.env.VENUE_EDGE_PER_SOURCE_BUFFER_BYTES ??
        256 * 1024 * 1024
    ),
    reservedFreeDiskBytes: Number(
      overrides.reservedFreeDiskBytes ??
        process.env.VENUE_EDGE_RESERVED_FREE_DISK_BYTES ??
        2 * 1024 * 1024 * 1024
    ),
    minFreeMemoryBytes: Number(
      overrides.minFreeMemoryBytes ??
        process.env.VENUE_EDGE_MIN_FREE_MEMORY_BYTES ??
        512 * 1024 * 1024
    ),
    maxCpuLoadAverage: Number(
      overrides.maxCpuLoadAverage ?? process.env.VENUE_EDGE_MAX_CPU_LOAD ?? 4
    ),
    maxCpuPercent: Number(
      overrides.maxCpuPercent ?? process.env.VENUE_EDGE_MAX_CPU_PERCENT ?? 85
    ),
    maxNetworkMbps: Number(
      overrides.maxNetworkMbps ?? process.env.VENUE_EDGE_MAX_NETWORK_MBPS ?? 100
    ),
    estimatedSourceNetworkMbps: Number(
      overrides.estimatedSourceNetworkMbps ??
        process.env.VENUE_EDGE_ESTIMATED_SOURCE_NETWORK_MBPS ??
        8
    ),
  }
}
