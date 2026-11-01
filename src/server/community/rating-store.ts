// Applies a completed 1v1 scoreboard match to both players' ratings
// (docs/community/README.md, M5). Runs from the outbox; safe to retry.

import { and, eq, inArray, sql } from "drizzle-orm"

import db from "@/db/drizzle"
import { communityRatedMatches, matches, matchPlayers, playerRatings } from "@/db/schema"

import { matchScore, rateMatch, RATING_RULES } from "./rating-rules.ts"

export async function applyMatchRating(tenantId: string, matchId: string) {
  const [match] = await db
    .select({ id: matches.id, status: matches.status, gamesA: matches.scorePlayerA, gamesB: matches.scorePlayerB })
    .from(matches)
    .where(and(eq(matches.id, matchId), eq(matches.tenantId, tenantId)))
    .limit(1)

  if (!match || match.status !== "completed") return { skipped: true, reason: "not_completed" }

  const sides = await db
    .select({ side: matchPlayers.side, userId: matchPlayers.userId })
    .from(matchPlayers)
    .where(eq(matchPlayers.matchId, matchId))

  const playerA = sides.find((row) => row.side === "a")?.userId
  const playerB = sides.find((row) => row.side === "b")?.userId
  // Matches without assigned players don't count.
  if (!playerA || !playerB || playerA === playerB) return { skipped: true, reason: "sides_missing" }

  return db.transaction(async (tx) => {
    for (const userId of [playerA, playerB]) {
      await tx
        .insert(playerRatings)
        .values({ userId, tenantId, rating: RATING_RULES.start, ratedMatches: 0 })
        .onConflictDoNothing()
    }

    // Lock both rows in a fixed order so concurrent matches can't deadlock.
    const ordered = [playerA, playerB].sort()
    const rows = await tx
      .select()
      .from(playerRatings)
      .where(inArray(playerRatings.userId, ordered))
      .orderBy(playerRatings.userId)
      .for("update")

    const ratingA = rows.find((row) => row.userId === playerA)!
    const ratingB = rows.find((row) => row.userId === playerB)!
    const result = rateMatch(ratingA, ratingB, matchScore(match.gamesA, match.gamesB))

    const [ledger] = await tx
      .insert(communityRatedMatches)
      .values({ matchId, tenantId, deltaA: result.a.delta, deltaB: result.b.delta })
      .onConflictDoNothing()
      .returning({ matchId: communityRatedMatches.matchId })

    // Already rated by an earlier attempt.
    if (!ledger) return { skipped: true, reason: "already_rated" }

    const now = new Date()
    await tx
      .update(playerRatings)
      .set({ rating: result.a.rating, ratedMatches: sql`${playerRatings.ratedMatches} + 1`, updatedAt: now })
      .where(eq(playerRatings.userId, playerA))
    await tx
      .update(playerRatings)
      .set({ rating: result.b.rating, ratedMatches: sql`${playerRatings.ratedMatches} + 1`, updatedAt: now })
      .where(eq(playerRatings.userId, playerB))

    return { rated: true, deltaA: result.a.delta, deltaB: result.b.delta }
  })
}

export async function isMatchRated(matchId: string) {
  const [row] = await db
    .select({ matchId: communityRatedMatches.matchId })
    .from(communityRatedMatches)
    .where(eq(communityRatedMatches.matchId, matchId))
    .limit(1)
  return Boolean(row)
}
