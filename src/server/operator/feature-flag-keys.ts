export const KNOWN_FEATURE_FLAG_KEYS = [
  "operator_shell",
  "device_registry",
  "private_media",
  "replay_edge",
  "public_venue_api",
] as const

export type KnownFeatureFlagKey = (typeof KNOWN_FEATURE_FLAG_KEYS)[number]

export const FEATURE_FLAG_LABELS: Record<KnownFeatureFlagKey, string> = {
  operator_shell: "Operator / admin shell",
  device_registry: "Device registry",
  private_media: "Private media (R2)",
  replay_edge: "Replay edge capture",
  public_venue_api: "Public venue API",
}
