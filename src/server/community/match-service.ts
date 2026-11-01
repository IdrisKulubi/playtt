// Scoreboard players and head-to-head (docs/community/README.md, M5).

import { and, eq, inArray, isNull, sql } from "drizzle-orm"
import { alias } from "drizzle-orm/pg-core"

import db from "@/db/drizzle"
import { bookings, communityBookingPartners, matches, matchPlayers, playSessions } from "@/db/schema"
import type { TenantContext } from "@/server/tenancy/types"

import { CommunityError } from "./errors.ts"
import { deliverCommunityNotificationSoon, enqueueCommunityNotification } from "./notify.ts"
import { headToHead } from "./rating-rules.ts"
import { isMatchRated } from "./rating-store.ts"
import { requireVisiblePlayer } from "./service.ts"
import { SOCIAL_LIMITS } from "./constants.ts"

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const opponent = alias(matchPlayers, "opponent")

function notAllowed(message: string, status = 409): never {
  throw new CommunityError("BOOKING_NOT_JOINABLE", message, status)
}

export type BookingMatchInfo = {
  matchId: string
  status: string
  gamesA: number
  gamesB: number
  sideA: string | null
  sideB: string | null
  rated: boolean
}

/** Match state for shared bookings, keyed by booking id. */
export async function loadBookingMatches(bookingIds: string[]) {
  if (bookingIds.length === 0) return new Map<string, BookingMatchInfo>()

  const rows = await db
    .select({
      bookingId: matches.bookingId,
      matchId: matches.id,
      status: matches.status,
      gamesA: matches.scorePlayerA,
      gamesB: matches.scorePlayerB,
      side: matchPlayers.side,
      userId: matchPlayers.userId,
      rated: sql<boolean>`exists (select 1 from community_rated_matches r where r.match_id = ${matches.id})`,
    })
    .from(matches)
    .leftJoin(matchPlayers, eq(matchPlayers.matchId, matches.id))
    .where(inArray(matches.bookingId, bookingIds))

  const byBooking = new Map<string, BookingMatchInfo>()
  for (const row of rows) {
    const entry = byBooking.get(row.bookingId) ?? {
      matchId: row.matchId,
      status: row.status,
      gamesA: row.gamesA,
      gamesB: row.gamesB,
      sideA: null,
      sideB: null,
      rated: Boolean(row.rated),
    }
    if (row.side === "a") entry.sideA = row.userId
    if (row.side === "b") entry.sideB = row.userId
    byBooking.set(row.bookingId, entry)
  }
  return byBooking
}

/**
 * The host records who played which side (1v1). Optional: unassigned matches
 * simply don't count. Locked once the match has been rated.
 */
export async function assignMatchSides(
  context: TenantContext,
  viewerId: string,
  bookingId: string,
  input: { sideA: string; sideB: string },
) {
  if (!UUID_PATTERN.test(bookingId)) notAllowed("We could not find that booking.", 404)
  if (input.sideA === input.sideB) notAllowed("Pick a different player for each side.")

  const now = new Date()
  const [booking] = await db
    .select({
      id: bookings.id,
      hostId: bookings.userId,
      status: bookings.status,
      startTime: bookings.startTime,
      endTime: bookings.endTime,
      locationId: bookings.locationId,
      playSessionId: playSessions.id,
    })
    .from(bookings)
    .leftJoin(playSessions, eq(playSessions.bookingId, bookings.id))
    .where(and(eq(bookings.id, bookingId), eq(bookings.tenantId, context.tenantId)))
    .limit(1)

  if (!booking) notAllowed("We could not find that booking.", 404)
  if (booking.hostId !== viewerId) notAllowed("Only the host can record who played.", 403)
  if (booking.status === "cancelled") notAllowed("This booking was cancelled.")
  if (booking.startTime > now) notAllowed("You can record sides once the game starts.")
  if (now.getTime() - booking.endTime.getTime() > SOCIAL_LIMITS.kudosWindowMs) {
    notAllowed("Sides can be recorded up to 72 hours after the game.")
  }

  // Both players must be on the booking: the host or an active partner.
  const partners = await db
    .select({ userId: communityBookingPartners.userId })
    .from(communityBookingPartners)
    .where(and(eq(communityBookingPartners.bookingId, bookingId), isNull(communityBookingPartners.leftAt)))
  const onBooking = new Set([booking.hostId, ...partners.map((row) => row.userId)])
  if (!onBooking.has(input.sideA) || !onBooking.has(input.sideB)) {
    notAllowed("Both players need to be on this booking.")
  }

  if (!booking.playSessionId) notAllowed("This booking isn't ready yet.")
  const playSessionId = booking.playSessionId

  await db
    .insert(matches)
    .values({ tenantId: context.tenantId, bookingId, playSessionId, locationId: booking.locationId })
    .onConflictDoNothing({ target: matches.bookingId })

  const [match] = await db
    .select({ id: matches.id, status: matches.status })
    .from(matches)
    .where(eq(matches.bookingId, bookingId))
    .limit(1)
  if (!match) throw new Error("Could not load the booking's match.")

  if (await isMatchRated(match.id)) notAllowed("This match is already rated, so sides are locked.")

  await db.transaction(async (tx) => {
    await tx.delete(matchPlayers).where(eq(matchPlayers.matchId, match.id))
    await tx.insert(matchPlayers).values([
      { tenantId: context.tenantId, matchId: match.id, side: "a", userId: input.sideA, assignedBy: viewerId },
      { tenantId: context.tenantId, matchId: match.id, side: "b", userId: input.sideB, assignedBy: viewerId },
    ])
    if (match.status === "completed") {
      await enqueueCommunityNotification(context.tenantId, { kind: "match_completed", matchId: match.id }, tx)
    }
  })

  if (match.status === "completed") {
    deliverCommunityNotificationSoon(context.tenantId, { kind: "match_completed", matchId: match.id })
  }

  return (await loadBookingMatches([bookingId])).get(bookingId) ?? null
}

export async function getHeadToHead(context: TenantContext, viewerId: string, targetId: string) {
  await requireVisiblePlayer(context, viewerId, targetId)

  const rows = await db
    .select({
      matchId: matches.id,
      side: matchPlayers.side,
      gamesA: matches.scorePlayerA,
      gamesB: matches.scorePlayerB,
      playedAt: sql<Date>`coalesce(${matches.endedAt}, ${matches.updatedAt})`,
    })
    .from(matchPlayers)
    .innerJoin(matches, eq(matches.id, matchPlayers.matchId))
    .innerJoin(
      opponent,
      and(eq(opponent.matchId, matchPlayers.matchId), eq(opponent.userId, targetId), sql`${opponent.side} <> ${matchPlayers.side}`),
    )
    .where(
      and(
        eq(matches.tenantId, context.tenantId),
        eq(matches.status, "completed"),
        eq(matchPlayers.userId, viewerId),
      ),
    )

  return {
    headToHead: headToHead(
      rows.map((row) => ({
        matchId: row.matchId,
        playedAt: new Date(row.playedAt),
        myGames: row.side === "a" ? row.gamesA : row.gamesB,
        theirGames: row.side === "a" ? row.gamesB : row.gamesA,
      })),
    ),
  }
}
