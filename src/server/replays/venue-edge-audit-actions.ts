export const VENUE_EDGE_AUDIT_ACTIONS = {
  configPublished: "venue_edge.config.published",
  configApplied: "venue_edge.config.applied",
  configRejected: "venue_edge.config.rejected",
  rolloutUpdated: "venue_edge.rollout.updated",
} as const

export type VenueEdgeAuditAction =
  (typeof VENUE_EDGE_AUDIT_ACTIONS)[keyof typeof VENUE_EDGE_AUDIT_ACTIONS]
