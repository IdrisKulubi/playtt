// Loads everything a player card shows (docs/community/player-card.md):
// session stats, kudos, reliability, badges and card points, batched per page of players.

import { and, eq, inArray, isNotNull, lte, or, sql } from "drizzle-orm"
import { alias } from "drizzle-orm/pg-core"

import db from "@/db/drizzle"
import {
  bookings,
  coachTrainingItems,
  communityBookingPartners,
  communityKudos,
  communityReliabilityOverrides,
  matches,
  matchPlayers,
  playSessions,
  sessionParticipants,
} from "@/db/schema"
import type { TenantContext } from "@/server/tenancy/types"

import { EMPTY_CARD_STATS, groupCardStats, toCardStatWeeks, type CardStats } from "./card-stats.ts"
import { cardProgress } from "./card-points.ts"
import type { KudosType } from "./constants.ts"
import { isInForm, winRate, type RecordedResult } from "./rating-rules.ts"
import {
  computeReliability,
  kudosBadges,
  topKudos,
  type KudosCounts,
  type SharedBookingFact,
} from "./social-rules.ts"

export type CardData = {
  stats: CardStats
  badges: string[]
  topKudos: { type: KudosType; count: number }[]
}

export const EMPTY_CARD_DATA: CardData = { stats: EMPTY_CARD_STATS, badges: [], topKudos: [] }

// A session counts once it is completed, or confirmed and already over.
function playedBooking(now: Date) {
  return or(
    eq(bookings.status, "completed"),
    and(eq(bookings.status, "confirmed"), lte(bookings.endTime, now)),
  )
}

async function loadSessionRows(context: TenantContext, userIds: string[], now: Date) {
  const columns = {
    bookingId: bookings.id,
    startTime: bookings.startTime,
    durationMinutes: bookings.durationMinutes,
  }

  const [owned, joined] = await Promise.all([
    db
      .select({ userId: bookings.userId, ...columns })
      .from(bookings)
      .where(
        and(eq(bookings.tenantId, context.tenantId), inArray(bookings.userId, userIds), playedBooking(now)),
      ),
    db
      .select({ userId: sessionParticipants.userId, ...columns })
      .from(sessionParticipants)
      .innerJoin(playSessions, eq(playSessions.id, sessionParticipants.playSessionId))
      .innerJoin(bookings, eq(bookings.id, playSessions.bookingId))
      .where(
        and(
          eq(sessionParticipants.tenantId, context.tenantId),
          inArray(sessionParticipants.userId, userIds),
          playedBooking(now),
        ),
      ),
  ])

  return [...owned, ...joined]
}

async function loadKudosCounts(context: TenantContext, userIds: string[]) {
  const rows = await db
    .select({
      userId: communityKudos.receiverId,
      type: communityKudos.type,
      count: sql<number>`count(*)::int`,
    })
    .from(communityKudos)
    .where(and(eq(communityKudos.tenantId, context.tenantId), inArray(communityKudos.receiverId, userIds)))
    .groupBy(communityKudos.receiverId, communityKudos.type)

  const counts = new Map<string, KudosCounts>()
  for (const row of rows) {
    const entry = counts.get(row.userId) ?? {}
    entry[row.type] = row.count
    counts.set(row.userId, entry)
  }
  return counts
}

/** Shared community bookings (with at least one other partner) per player. */
export async function loadSharedBookingFacts(context: TenantContext, userIds: string[]) {
  const rows = await db
    .select({
      userId: communityBookingPartners.userId,
      bookingId: communityBookingPartners.bookingId,
      role: communityBookingPartners.role,
      leftAt: communityBookingPartners.leftAt,
      bookingStatus: bookings.status,
      startTime: bookings.startTime,
      endTime: bookings.endTime,
      cancelledAt: bookings.cancelledAt,
      sessionStartedAt: playSessions.startedAt,
      excused: sql<boolean>`${communityReliabilityOverrides.id} is not null`,
    })
    .from(communityBookingPartners)
    .innerJoin(bookings, eq(bookings.id, communityBookingPartners.bookingId))
    .leftJoin(playSessions, eq(playSessions.bookingId, bookings.id))
    .leftJoin(
      communityReliabilityOverrides,
      and(
        eq(communityReliabilityOverrides.bookingId, communityBookingPartners.bookingId),
        eq(communityReliabilityOverrides.userId, communityBookingPartners.userId),
      ),
    )
    .where(
      and(
        eq(communityBookingPartners.tenantId, context.tenantId),
        inArray(communityBookingPartners.userId, userIds),
        // Only bookings someone else joined count as shared.
        sql`exists (
          select 1 from ${communityBookingPartners} other
          where other.booking_id = ${communityBookingPartners.bookingId}
            and other.user_id <> ${communityBookingPartners.userId}
        )`,
      ),
    )

  const facts = new Map<string, SharedBookingFact[]>()
  for (const row of rows) {
    const list = facts.get(row.userId) ?? []
    list.push({
      bookingId: row.bookingId,
      role: row.role,
      bookingStatus: row.bookingStatus,
      startTime: row.startTime,
      endTime: row.endTime,
      cancelledAt: row.cancelledAt,
      leftAt: row.leftAt,
      sessionStartedAt: row.sessionStartedAt,
      excused: Boolean(row.excused),
    })
    facts.set(row.userId, list)
  }
  return facts
}

const opponent = alias(matchPlayers, "opponent")

/** Completed 1v1 scoreboard matches with assigned players, per player. */
export async function loadMatchResults(context: TenantContext, userIds: string[]) {
  const rows = await db
    .select({
      userId: matchPlayers.userId,
      side: matchPlayers.side,
      gamesA: matches.scorePlayerA,
      gamesB: matches.scorePlayerB,
      playedAt: sql<Date>`coalesce(${matches.endedAt}, ${matches.updatedAt})`,
    })
    .from(matchPlayers)
    .innerJoin(matches, eq(matches.id, matchPlayers.matchId))
    .innerJoin(opponent, and(eq(opponent.matchId, matchPlayers.matchId), sql`${opponent.side} <> ${matchPlayers.side}`))
    .where(
      and(
        eq(matches.tenantId, context.tenantId),
        eq(matches.status, "completed"),
        inArray(matchPlayers.userId, userIds),
      ),
    )

  const results = new Map<string, RecordedResult[]>()
  for (const row of rows) {
    const mine = row.side === "a" ? row.gamesA : row.gamesB
    const theirs = row.side === "a" ? row.gamesB : row.gamesA
    const list = results.get(row.userId) ?? []
    list.push({ won: mine === theirs ? null : mine > theirs, playedAt: new Date(row.playedAt) })
    results.set(row.userId, list)
  }
  return results
}

/** Coach drills each player has marked done. */
async function loadCompletedDrills(context: TenantContext, userIds: string[]) {
  const rows = await db
    .select({ userId: coachTrainingItems.userId, count: sql<number>`count(*)::int` })
    .from(coachTrainingItems)
    .where(
      and(
        eq(coachTrainingItems.tenantId, context.tenantId),
        inArray(coachTrainingItems.userId, userIds),
        isNotNull(coachTrainingItems.completedAt),
      ),
    )
    .groupBy(coachTrainingItems.userId)
  return new Map(rows.map((row) => [row.userId, row.count]))
}

export async function loadCardData(context: TenantContext, userIds: string[], now: Date) {
  if (userIds.length === 0) {
    return new Map<string, CardData>()
  }

  const [sessions, kudos, shared, results, drills] = await Promise.all([
    loadSessionRows(context, userIds, now),
    loadKudosCounts(context, userIds),
    loadSharedBookingFacts(context, userIds),
    loadMatchResults(context, userIds),
    loadCompletedDrills(context, userIds),
  ])

  const stats = groupCardStats(userIds, toCardStatWeeks(sessions), now)

  return new Map(
    userIds.map((id) => {
      const counts = kudos.get(id) ?? {}
      const totalKudos = Object.values(counts).reduce((sum, count) => sum + (count ?? 0), 0)
      const reliability = computeReliability(shared.get(id) ?? [], now)
      const recorded = results.get(id) ?? []
      const base = stats.get(id) ?? EMPTY_CARD_STATS
      const progress = cardProgress({
        wins: recorded.filter((result) => result.won === true).length,
        sessions: base.matches ?? 0,
        drills: drills.get(id) ?? 0,
        kudos: totalKudos,
      })
      const badges = kudosBadges(counts)
      if (isInForm(recorded)) badges.unshift("in_form")
      if (reliability.reliableBadge) badges.push("reliable")

      return [
        id,
        {
          stats: {
            ...base,
            kudos: totalKudos > 0 ? totalKudos : null,
            reliability: reliability.percent,
            rating: progress.rating,
            points: progress.points,
            tier: progress.tier,
            nextTierPoints: progress.nextTierPoints,
            winRate: winRate(recorded),
          },
          badges,
          topKudos: topKudos(counts),
        },
      ]
    }),
  )
}
