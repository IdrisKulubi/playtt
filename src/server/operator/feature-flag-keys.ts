export const KNOWN_FEATURE_FLAG_KEYS = [
  "operator_shell",
  "device_registry",
  "private_media",
  "replay_edge",
  "venue_edge_config_v2",
  "venue_edge_manual_approval",
  "public_venue_api",
  "live_access",
  "ttlock_provider",
  "relay_automation",
  "access_notifications",
  "remote_unlock",
] as const

export type KnownFeatureFlagKey = (typeof KNOWN_FEATURE_FLAG_KEYS)[number]

export const FEATURE_FLAG_LABELS: Record<KnownFeatureFlagKey, string> = {
  operator_shell: "Operator / admin shell",
  device_registry: "Device registry",
  private_media: "Private media (R2)",
  replay_edge: "Replay edge capture",
  venue_edge_config_v2: "VenueEdge config v2 rollout",
  venue_edge_manual_approval: "Require dashboard approval for VenueEdge setup changes",
  public_venue_api: "Public venue API",
  live_access: "Live booking access",
  ttlock_provider: "TTLock provider",
  relay_automation: "Venue relay automation",
  access_notifications: "Access notifications",
  remote_unlock: "Protected remote unlock",
}
