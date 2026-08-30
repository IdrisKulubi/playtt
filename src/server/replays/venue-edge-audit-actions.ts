export const VENUE_EDGE_AUDIT_ACTIONS = {
  configPublished: "venue_edge.config.published",
  configApplied: "venue_edge.config.applied",
  configRejected: "venue_edge.config.rejected",
  configRollback: "venue_edge.config.rollback",
  rolloutUpdated: "venue_edge.rollout.updated",
  pairingCreated: "venue_edge.pairing.created",
  pairingCancelled: "venue_edge.pairing.cancelled",
  pairingReissued: "venue_edge.pairing.reissued",
  pairingExpired: "venue_edge.pairing.expired",
  pairingConsumed: "venue_edge.pairing.consumed",
  pairingConfirmed: "venue_edge.pairing.confirmed",
  commissioningPublished: "venue_edge.commissioning.published",
  installationRenamed: "venue_edge.installation.rename",
  installationRevoked: "venue_edge.installation.revoke",
  installationRotateCredential: "venue_edge.installation.rotate_credential",
  updateStarted: "venue_edge.update.started",
  updateSucceeded: "venue_edge.update.succeeded",
  updateRolledBack: "venue_edge.update.rolled_back",
  updateFailed: "venue_edge.update.failed",
  updateChannelChanged: "venue_edge.update.channel_changed",
  updatePinned: "venue_edge.update.pinned",
  updateRetryRequested: "venue_edge.update.retry_requested",
} as const

export type VenueEdgeAuditAction =
  (typeof VENUE_EDGE_AUDIT_ACTIONS)[keyof typeof VENUE_EDGE_AUDIT_ACTIONS]
