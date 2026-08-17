export interface ScoreHint {
  playSessionId: string
  snapshotVersion: number
  eventId: string
  state?: Record<string, unknown>
}

export interface RealtimeSubscription {
  unsubscribe(): void
}

export interface RealtimeAdapter {
  publish(channel: string, message: ScoreHint): Promise<void>
  subscribe(
    channel: string,
    onMessage: (message: ScoreHint) => void,
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
