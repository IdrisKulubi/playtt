import { getRealtimeAdapter } from "@/server/realtime/broadcaster"
import {
  resourceChannel,
  sessionChannel,
  venueChannel,
  type ScoreHint,
} from "@/server/realtime/types"
import type { ScoreState } from "@/server/scoring/types"
import {
  EVENT_VERSION,
  EVENT_TYPES,
} from "@/server/workers/events.mjs"

type ScoreUpdatedOutboxRow = {
  id: string
  tenantId: string | null
  venueId: string | null
  resourceId: string | null
  sessionId: string | null
  payload: Record<string, unknown>
}

function parseScoreHint(row: ScoreUpdatedOutboxRow): ScoreHint | null {
  const playSessionId = String(row.payload.playSessionId ?? row.sessionId ?? "")
  const snapshotVersion = Number(row.payload.snapshotVersion)
  const eventId = String(row.payload.eventId ?? row.id)

  if (!playSessionId || !Number.isFinite(snapshotVersion) || !eventId) {
    return null
  }

  const state = row.payload.state as ScoreState | undefined

  return {
    playSessionId,
    snapshotVersion,
    eventId,
    ...(state ? { state: state as unknown as Record<string, unknown> } : {}),
  }
}

export async function consumeScoreUpdated(row: ScoreUpdatedOutboxRow) {
  const tenantId = row.tenantId
  const resourceId = row.resourceId
  const venueId = row.venueId
  const sessionId = row.sessionId

  if (!tenantId || !resourceId) {
    throw new Error("score.updated.v1 event is missing tenant/resource scope.")
  }

  const hint = parseScoreHint(row)

  if (!hint) {
    throw new Error("score.updated.v1 event is missing payload fields.")
  }

  const adapter = getRealtimeAdapter()
  const channels = [resourceChannel(tenantId, resourceId)]

  if (venueId) {
    channels.push(venueChannel(tenantId, venueId))
  }

  if (sessionId) {
    channels.push(sessionChannel(tenantId, sessionId))
  }

  try {
    await Promise.all(channels.map((channel) => adapter.publish(channel, hint)))
  } catch (error) {
    console.error("[realtime] score.updated.v1 fan-out failed", error)
  }
}

export function createScoreUpdatedConsumers() {
  return {
    [EVENT_TYPES.SCORE_UPDATED_V1]: {
      eventVersion: EVENT_VERSION,
      consume: consumeScoreUpdated,
    },
  }
}
