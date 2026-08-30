export const REPLAY_EDGE_FLAG_KEY = "replay_edge"
export const VENUE_EDGE_CONFIG_V2_FLAG_KEY = "venue_edge_config_v2"

export function resolveFeatureFlagEnvFallback(flagKey: string): boolean {
  if (flagKey === REPLAY_EDGE_FLAG_KEY) {
    return (
      process.env.REPLAY_EDGE_ENABLED === "true" ||
      process.env.NODE_ENV !== "production"
    )
  }

  if (flagKey === VENUE_EDGE_CONFIG_V2_FLAG_KEY) {
    return process.env.NODE_ENV !== "production"
  }

  return false
}
