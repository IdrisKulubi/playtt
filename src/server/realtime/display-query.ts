import { and, eq } from "drizzle-orm"

import db from "@/db/drizzle"
import { playSessions, resources, scoreSnapshots } from "@/db/schema"
import type { ScoreState } from "@/server/scoring/types"

export interface DisplayResourceSummary {
  id: string
  tenantId: string
  locationId: string
  name: string
  slug: string
  code: string | null
}

export interface DisplayPlaySessionSummary {
  id: string
  bookingId: string
  status: string
  scheduledStartAt: string
  scheduledEndAt: string
}

export interface DisplaySnapshotSummary {
  id: string
  version: number
  state: ScoreState
  lastEventId: string | null
  updatedAt: string
}

export type DisplaySnapshotResponse =
  | {
      status: "idle"
      resource: DisplayResourceSummary
      playSession: null
      snapshot: null
    }
  | {
      status: "active"
      resource: DisplayResourceSummary
      playSession: DisplayPlaySessionSummary
      snapshot: DisplaySnapshotSummary | null
    }

function mapSnapshotState(state: Record<string, unknown>): ScoreState {
  return state as unknown as ScoreState
}

export async function getDisplaySnapshotForResource(
  resourceId: string,
): Promise<DisplaySnapshotResponse | null> {
  const [resource] = await db
    .select({
      id: resources.id,
      tenantId: resources.tenantId,
      locationId: resources.locationId,
      name: resources.name,
      slug: resources.slug,
      code: resources.code,
    })
    .from(resources)
    .where(eq(resources.id, resourceId))
    .limit(1)

  if (!resource) {
    return null
  }

  const resourceSummary: DisplayResourceSummary = {
    id: resource.id,
    tenantId: resource.tenantId,
    locationId: resource.locationId,
    name: resource.name,
    slug: resource.slug,
    code: resource.code,
  }

  const [playSession] = await db
    .select({
      id: playSessions.id,
      bookingId: playSessions.bookingId,
      status: playSessions.status,
      scheduledStartAt: playSessions.scheduledStartAt,
      scheduledEndAt: playSessions.scheduledEndAt,
    })
    .from(playSessions)
    .where(
      and(
        eq(playSessions.tenantId, resource.tenantId),
        eq(playSessions.resourceId, resource.id),
        eq(playSessions.status, "active"),
      ),
    )
    .limit(1)

  if (!playSession) {
    return {
      status: "idle",
      resource: resourceSummary,
      playSession: null,
      snapshot: null,
    }
  }

  const [snapshot] = await db
    .select({
      id: scoreSnapshots.id,
      version: scoreSnapshots.version,
      state: scoreSnapshots.state,
      lastEventId: scoreSnapshots.lastEventId,
      updatedAt: scoreSnapshots.updatedAt,
    })
    .from(scoreSnapshots)
    .where(
      and(
        eq(scoreSnapshots.tenantId, resource.tenantId),
        eq(scoreSnapshots.playSessionId, playSession.id),
      ),
    )
    .limit(1)

  return {
    status: "active",
    resource: resourceSummary,
    playSession: {
      id: playSession.id,
      bookingId: playSession.bookingId,
      status: playSession.status,
      scheduledStartAt: playSession.scheduledStartAt.toISOString(),
      scheduledEndAt: playSession.scheduledEndAt.toISOString(),
    },
    snapshot: snapshot
      ? {
          id: snapshot.id,
          version: snapshot.version,
          state: mapSnapshotState(snapshot.state),
          lastEventId: snapshot.lastEventId,
          updatedAt: snapshot.updatedAt.toISOString(),
        }
      : null,
  }
}
