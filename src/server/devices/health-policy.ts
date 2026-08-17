export type DeviceHealthStatus = "online" | "offline" | "unknown"

export const DEFAULT_OFFLINE_THRESHOLD_SECONDS = 300
export const DEFAULT_HEARTBEAT_SAMPLE_INTERVAL_SECONDS = 60
export const DEFAULT_COMMAND_TTL_SECONDS = 300

export function getOfflineThresholdSeconds(): number {
  const parsed = Number(process.env.DEVICE_OFFLINE_THRESHOLD_SECONDS)
  return Number.isFinite(parsed) && parsed > 0
    ? parsed
    : DEFAULT_OFFLINE_THRESHOLD_SECONDS
}

export function getHeartbeatSampleIntervalSeconds(): number {
  const parsed = Number(process.env.DEVICE_HEARTBEAT_SAMPLE_INTERVAL_SECONDS)
  return Number.isFinite(parsed) && parsed > 0
    ? parsed
    : DEFAULT_HEARTBEAT_SAMPLE_INTERVAL_SECONDS
}

export function deriveDeviceHealth(
  lastHeartbeatAt: Date | null | undefined,
  now: Date = new Date(),
): DeviceHealthStatus {
  if (!lastHeartbeatAt) {
    return "unknown"
  }

  const thresholdMs = getOfflineThresholdSeconds() * 1000
  return now.getTime() - lastHeartbeatAt.getTime() <= thresholdMs
    ? "online"
    : "offline"
}
