export type HealthStatus = "ok" | "degraded" | "down" | "not_configured"

export type HealthDimensionKey =
  | "devices"
  | "edge"
  | "sessions"
  | "workers"
  | "replay"
  | "access"
  | "network"

export interface HealthDimensionEvaluation {
  status: HealthStatus
  count: number
  summary: string
}

export interface HealthDimension extends HealthDimensionEvaluation {
  key: HealthDimensionKey
  label: string
  href: string | null
}

export interface VenueHealthSnapshot {
  venueId: string
  venueName: string
  status: HealthStatus
  dimensions: HealthDimension[]
}

export interface TenantHealthOverview {
  status: HealthStatus
  generatedAt: string
  tenantDimensions: HealthDimension[]
  venues: VenueHealthSnapshot[]
}

const STATUS_SEVERITY: Record<HealthStatus, number> = {
  not_configured: 0,
  ok: 1,
  degraded: 2,
  down: 3,
}

export const HEALTH_DIMENSION_LABELS: Record<HealthDimensionKey, string> = {
  devices: "Devices",
  edge: "Venue edge",
  sessions: "Sessions",
  workers: "Workers",
  replay: "Replay",
  access: "Access / TTLock",
  network: "Internet / WAN",
}

export const FAILED_REPLAY_STATUSES = [
  "failed",
  "expired",
  "edge_offline",
  "buffer_missing",
  "extraction_failed",
  "upload_failed",
] as const

export const IN_FLIGHT_REPLAY_STATUSES = [
  "requested",
  "authorized",
  "dispatched",
  "edge_acknowledged",
  "capturing",
  "extracting",
  "uploading",
  "verifying",
] as const

export const TERMINAL_PLAY_SESSION_STATUSES = ["available", "held"] as const

export const STUCK_SESSION_GRACE_MS = 5 * 60 * 1000

export function rollupHealthStatus(
  ...statuses: HealthStatus[]
): HealthStatus {
  const relevant = statuses.filter((status) => status !== "not_configured")

  if (relevant.length === 0) {
    return "not_configured"
  }

  return relevant.reduce<HealthStatus>((worst, current) => {
    return STATUS_SEVERITY[current] > STATUS_SEVERITY[worst] ? current : worst
  }, "ok")
}

export function evaluateDeviceDimension(
  deviceHealths: Array<"online" | "offline" | "unknown">,
): HealthDimensionEvaluation {
  if (deviceHealths.length === 0) {
    return {
      status: "not_configured",
      count: 0,
      summary: "No devices enrolled",
    }
  }

  const offline = deviceHealths.filter((health) => health === "offline").length
  const unknown = deviceHealths.filter((health) => health === "unknown").length
  const online = deviceHealths.filter((health) => health === "online").length

  if (offline === deviceHealths.length) {
    return {
      status: "down",
      count: offline,
      summary: `${offline} offline`,
    }
  }

  if (offline > 0 || unknown > 0) {
    return {
      status: "degraded",
      count: offline + unknown,
      summary: `${offline} offline, ${unknown} unknown`,
    }
  }

  return {
    status: "ok",
    count: online,
    summary: `${online} online`,
  }
}

export function evaluateEdgeDimension(
  edge:
    | {
        health: "online" | "offline" | "unknown"
        replayQueueDepth?: number
        maxConcurrentReplays?: number
      }
    | null,
): HealthDimensionEvaluation {
  if (!edge) {
    return {
      status: "not_configured",
      count: 0,
      summary: "No venue edge device",
    }
  }

  if (edge.health === "offline") {
    return {
      status: "down",
      count: 1,
      summary: "Venue edge offline",
    }
  }

  if (edge.health === "unknown") {
    return {
      status: "degraded",
      count: 1,
      summary: "Venue edge heartbeat unknown",
    }
  }

  const queueDepth = edge.replayQueueDepth ?? 0
  const maxConcurrent = edge.maxConcurrentReplays ?? 0

  if (maxConcurrent > 0 && queueDepth >= maxConcurrent) {
    return {
      status: "degraded",
      count: queueDepth,
      summary: `Replay queue at capacity (${queueDepth}/${maxConcurrent})`,
    }
  }

  return {
    status: "ok",
    count: 0,
    summary: "Venue edge online",
  }
}

export function evaluateSessionDimension(
  stuckCount: number,
): HealthDimensionEvaluation {
  if (stuckCount === 0) {
    return {
      status: "ok",
      count: 0,
      summary: "No stuck sessions",
    }
  }

  if (stuckCount >= 3) {
    return {
      status: "down",
      count: stuckCount,
      summary: `${stuckCount} stuck sessions`,
    }
  }

  return {
    status: "degraded",
    count: stuckCount,
    summary: `${stuckCount} stuck session${stuckCount > 1 ? "s" : ""}`,
  }
}

export interface WorkerHealthInput {
  inboxBacklog: Record<string, number>
  outboxBacklog: Record<string, number>
  deadLetterInbox: number
  deadLetterOutbox: number
}

export function evaluateWorkerDimension(
  data: WorkerHealthInput,
): HealthDimensionEvaluation {
  const deadLetter = data.deadLetterInbox + data.deadLetterOutbox

  if (deadLetter > 0) {
    return {
      status: "down",
      count: deadLetter,
      summary: `${deadLetter} dead-letter job${deadLetter > 1 ? "s" : ""}`,
    }
  }

  const pending =
    (data.inboxBacklog.received ?? 0) +
    (data.inboxBacklog.processing ?? 0) +
    (data.outboxBacklog.pending ?? 0) +
    (data.outboxBacklog.processing ?? 0)
  const failed = data.inboxBacklog.failed ?? 0

  if (failed > 0) {
    return {
      status: "degraded",
      count: failed,
      summary: `${failed} failed webhook${failed > 1 ? "s" : ""}`,
    }
  }

  if (pending > 10) {
    return {
      status: "degraded",
      count: pending,
      summary: `${pending} jobs in backlog`,
    }
  }

  return {
    status: "ok",
    count: 0,
    summary: "Workers healthy",
  }
}

export function evaluateReplayDimension(
  failedCount: number,
  inFlightCount: number,
): HealthDimensionEvaluation {
  if (failedCount > 0) {
    return {
      status: "down",
      count: failedCount,
      summary: `${failedCount} failed replay${failedCount > 1 ? "s" : ""}`,
    }
  }

  if (inFlightCount > 5) {
    return {
      status: "degraded",
      count: inFlightCount,
      summary: `${inFlightCount} replays in progress`,
    }
  }

  return {
    status: "ok",
    count: inFlightCount,
    summary:
      inFlightCount > 0
        ? `${inFlightCount} replay${inFlightCount > 1 ? "s" : ""} in progress`
        : "No replay issues",
  }
}

export function evaluateNotConfiguredDimension(
  summary: string,
): HealthDimensionEvaluation {
  return {
    status: "not_configured",
    count: 0,
    summary,
  }
}

export function buildHealthDimension(
  key: HealthDimensionKey,
  evaluation: HealthDimensionEvaluation,
  href: string | null,
): HealthDimension {
  return {
    key,
    label: HEALTH_DIMENSION_LABELS[key],
    href,
    ...evaluation,
  }
}
