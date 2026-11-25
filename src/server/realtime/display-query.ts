import { and, asc, eq, gt, lt } from "drizzle-orm"

import db from "@/db/drizzle"
import {
  bookings,
  locations,
  playSessions,
  resources,
  scoreSnapshots,
  user,
} from "@/db/schema"
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

/**
 * A paid booking on this table, as the venue screen shows it. Only the
 * booker's first name leaves the server: the screen is public.
 */
export interface DisplayBookingSummary {
  bookingId: string
  firstName: string
  groupSize: number
  startsAt: string
  endsAt: string
}

/** What the table is booked for around now, so the screen can follow the clock. */
export interface DisplaySchedule {
  /** Booking whose time covers now. */
  current: DisplayBookingSummary | null
  /** The next booking later today (venue day), if any. */
  next: DisplayBookingSummary | null
  /** Server time, so a TV with a drifting clock can correct itself. */
  serverTime: string
  /** Venue name for the screen's footer. */
  venueName: string
}

export type DisplaySnapshotResponse =
  | {
      status: "idle"
      resource: DisplayResourceSummary
      playSession: null
      snapshot: null
      schedule: DisplaySchedule
    }
  | {
      status: "active"
      resource: DisplayResourceSummary
      playSession: DisplayPlaySessionSummary
      snapshot: DisplaySnapshotSummary | null
      schedule: DisplaySchedule
    }

function firstNameOf(fullName: string | null | undefined) {
  const first = (fullName ?? "").trim().split(/\s+/)[0] ?? ""
  if (first.length === 0) return "Player"
  const trimmed = first.slice(0, 24)
  return trimmed.charAt(0).toLocaleUpperCase("en") + trimmed.slice(1)
}

/**
 * Confirmed bookings on this table from now until the end of the next 18
 * hours. The screen picks "current" and "next" from these.
 */
async function getDisplaySchedule(resource: {
  id: string
  tenantId: string
  locationId: string
}): Promise<DisplaySchedule> {
  const now = new Date()
  const [location] = await db
    .select({ name: locations.name })
    .from(locations)
    .where(eq(locations.id, resource.locationId))
    .limit(1)
  const horizon = new Date(now.getTime() + 18 * 60 * 60 * 1000)

  const rows = await db
    .select({
      bookingId: bookings.id,
      startTime: bookings.startTime,
      endTime: bookings.endTime,
      groupSize: bookings.groupSize,
      userName: user.name,
    })
    .from(bookings)
    .innerJoin(user, eq(user.id, bookings.userId))
    .where(
      and(
        eq(bookings.tenantId, resource.tenantId),
        eq(bookings.resourceId, resource.id),
        eq(bookings.status, "confirmed"),
        gt(bookings.endTime, now),
        lt(bookings.startTime, horizon),
      ),
    )
    .orderBy(asc(bookings.startTime))
    .limit(6)

  const mapped = rows.map((row) => ({
    bookingId: row.bookingId,
    firstName: firstNameOf(row.userName),
    groupSize: row.groupSize,
    startsAt: row.startTime.toISOString(),
    endsAt: row.endTime.toISOString(),
  }))

  const current =
    mapped.find((booking) => new Date(booking.startsAt) <= now) ?? null
  const next =
    mapped.find((booking) => new Date(booking.startsAt) > now) ?? null

  return {
    current,
    next,
    serverTime: now.toISOString(),
    venueName: location?.name ?? "PlayTT",
  }
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

  const schedule = await getDisplaySchedule(resource)

  if (!playSession) {
    return {
      status: "idle",
      resource: resourceSummary,
      playSession: null,
      snapshot: null,
      schedule,
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
    schedule,
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

function mapSnapshotState(state: Record<string, unknown>): ScoreState {
  return state as unknown as ScoreState
}

export async function resolveResourceIdByCodeOrId(
  identifier: string,
): Promise<string | null> {
  const trimmed = identifier.trim()

  if (!trimmed) {
    return null
  }

  const byId = await getDisplaySnapshotForResource(trimmed)

  if (byId) {
    return trimmed
  }

  const [resource] = await db
    .select({ id: resources.id })
    .from(resources)
    .where(eq(resources.code, trimmed))
    .limit(1)

  return resource?.id ?? null
}
