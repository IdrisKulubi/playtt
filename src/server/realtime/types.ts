export interface ScoreHint {
  playSessionId: string
  snapshotVersion: number
  eventId: string
  state?: Record<string, unknown>
}

export interface ReplayReadyHint {
  type: "replay.ready"
  tenantId: string
  venueId: string
  resourceId: string
  sessionId: string
  replayId: string
  mediaId: string
}

export type RealtimeMessage = ScoreHint | ReplayReadyHint

export interface RealtimeSubscription {
  unsubscribe(): void
}

export interface RealtimeAdapter {
  publish(channel: string, message: RealtimeMessage): Promise<void>
  subscribe(
    channel: string,
    onMessage: (message: RealtimeMessage) => void,
  ): RealtimeSubscription
}

export function resourceChannel(tenantId: string, resourceId: string) {
  return `tenant:${tenantId}:resource:${resourceId}`
}

export function venueChannel(tenantId: string, venueId: string) {
  return `tenant:${tenantId}:venue:${venueId}`
}

export function sessionChannel(tenantId: string, sessionId: string) {
  return `tenant:${tenantId}:session:${sessionId}`
}

export function isScoreHint(message: RealtimeMessage): message is ScoreHint {
  return "snapshotVersion" in message
}

export function isReplayReadyHint(
  message: RealtimeMessage,
): message is ReplayReadyHint {
  return "type" in message && message.type === "replay.ready"
}
