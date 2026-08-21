import {
  enqueueCoachAnalysisForReplay,
  publishReplayReadyRealtime,
} from "@/server/replays/edge-completion"
import { consumeReplayReadyEmail } from "@/server/replays/replay-ready-email"
import {
  EVENT_TYPES,
  EVENT_VERSION,
} from "@/server/workers/events.mjs"

type ReplayReadyOutboxRow = {
  tenantId: string | null
  venueId: string | null
  resourceId: string | null
  sessionId: string | null
  payload: Record<string, unknown>
}

export async function consumeReplayReady(row: ReplayReadyOutboxRow) {
  const tenantId = row.tenantId
  const replayId = String(row.payload.replayId ?? "")
  const userId = String(row.payload.userId ?? "")
  const bookingId = String(row.payload.bookingId ?? "")
  const mediaId = String(row.payload.mediaId ?? "")
  const resourceId = String(row.payload.resourceId ?? row.resourceId ?? "")
  const sessionId = String(row.payload.playSessionId ?? row.sessionId ?? "")
  const venueId = String(row.payload.locationId ?? row.venueId ?? "")

  if (!tenantId || !replayId || !mediaId || !resourceId || !sessionId) {
    throw new Error("replay.ready.v1 event is missing required payload fields.")
  }

  if (userId && bookingId) {
    await enqueueCoachAnalysisForReplay({
      tenantId,
      replayId,
      userId,
      bookingId,
    })
  }

  if (venueId) {
    await publishReplayReadyRealtime({
      tenantId,
      venueId,
      resourceId,
      sessionId,
      replayId,
      mediaId,
    })
  }

  await consumeReplayReadyEmail(row)
}

export function createReplayReadyConsumers() {
  return {
    [EVENT_TYPES.REPLAY_READY_V1]: {
      eventVersion: EVENT_VERSION,
      consume: consumeReplayReady,
    },
  }
}
