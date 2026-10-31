import { and, asc, desc, eq, inArray, isNull, lte, or, sql } from "drizzle-orm"

import db from "@/db/drizzle"
import {
  bookings,
  communityReports,
  follows,
  locations,
  playAvailability,
  playerProfiles,
  playSessions,
  sessionParticipants,
  user,
  userBlocks,
} from "@/db/schema"
import type { TenantContext } from "@/server/tenancy/types"

import { isOpenNow, resolveAvailabilityWindow } from "./availability-window.ts"
import {
  EMPTY_CARD_STATS,
  groupCardStats,
  toCardStatWeeks,
  type CardStats,
} from "./card-stats.ts"
import { COMMUNITY_LIMITS, type PlayAvailabilityWindow } from "./constants.ts"
import { toCommunityDisplayName } from "./display-name.ts"
import { CommunityError } from "./errors.ts"
import { consumeCommunityRateLimit } from "./rate-limit.ts"
import { canMessage, canSee, isRallyPartner, type RelationshipFacts } from "./visibility.ts"
import type {
  CommunityAvailabilityInput,
  CommunityPlayersQuery,
  CommunityProfilePatch,
  CommunityReportInput,
} from "./http.ts"

type ProfileRow = typeof playerProfiles.$inferSelect
type AvailabilityRow = typeof playAvailability.$inferSelect

export type HomeVenue = { id: string; name: string; timezone: string }

const DEFAULT_PROFILE = {
  communityVisible: false,
  bio: null,
  playStyle: null,
  handedness: null,
  usualTimes: [] as string[],
  requestPolicy: "everyone" as const,
  showAtVenue: false,
  foundingPlayer: false,
}

function serializeProfile(row: ProfileRow | null | undefined) {
  const profile = row ?? DEFAULT_PROFILE
  return {
    communityVisible: profile.communityVisible,
    bio: profile.bio,
    playStyle: profile.playStyle,
    handedness: profile.handedness,
    usualTimes: profile.usualTimes,
    requestPolicy: profile.requestPolicy,
    showAtVenue: profile.showAtVenue,
    foundingPlayer: profile.foundingPlayer,
  }
}

function serializeAvailability(row: AvailabilityRow | null | undefined, now = new Date()) {
  if (!row || row.endedAt || row.endsAt <= now) {
    return null
  }

  return {
    window: row.window,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
    note: row.note,
    lookingForDoubles: row.lookingForDoubles,
    openNow: isOpenNow(row, now),
  }
}

function encodeCursor(offset: number) {
  return Buffer.from(String(offset)).toString("base64url")
}

function decodeCursor(cursor: string | undefined) {
  if (!cursor) return 0
  const value = Number(Buffer.from(cursor, "base64url").toString())
  return Number.isInteger(value) && value >= 0 ? value : 0
}

function assertRateLimit(scope: Parameters<typeof consumeCommunityRateLimit>[0], userId: string) {
  if (!consumeCommunityRateLimit(scope, userId)) {
    throw new CommunityError("RATE_LIMITED", "Too many requests. Try again later.", 429)
  }
}

// --- Home venue -----------------------------------------------------------

async function firstActiveLocation(context: TenantContext) {
  const [row] = await db
    .select({ id: locations.id, name: locations.name, timezone: locations.timezone })
    .from(locations)
    .where(and(eq(locations.tenantId, context.tenantId), eq(locations.isActive, true)))
    .orderBy(asc(locations.name))
    .limit(1)
  return row ?? null
}

export async function resolveHomeVenue(
  context: TenantContext,
  userId: string,
): Promise<HomeVenue | null> {
  const [row] = await db
    .select({ id: locations.id, name: locations.name, timezone: locations.timezone })
    .from(user)
    .innerJoin(locations, eq(locations.id, user.defaultLocationId))
    .where(
      and(
        eq(user.id, userId),
        eq(locations.tenantId, context.tenantId),
        eq(locations.isActive, true),
      ),
    )
    .limit(1)

  return row ?? firstActiveLocation(context)
}

async function requireHomeVenue(context: TenantContext, userId: string) {
  const venue = await resolveHomeVenue(context, userId)
  if (!venue) {
    throw new CommunityError("NO_HOME_VENUE", "No active PlayTT venue is available.", 409)
  }
  return venue
}

// --- Relationship facts ---------------------------------------------------

type RelationshipMaps = {
  viewerFollows: Set<string>
  followsViewer: Set<string>
  viewerBlocked: Set<string>
  blockedViewer: Set<string>
}

async function loadRelationships(viewerId: string, targetIds: string[]): Promise<RelationshipMaps> {
  const maps: RelationshipMaps = {
    viewerFollows: new Set(),
    followsViewer: new Set(),
    viewerBlocked: new Set(),
    blockedViewer: new Set(),
  }

  if (targetIds.length === 0) {
    return maps
  }

  const [followRows, blockRows] = await Promise.all([
    db
      .select({ followerId: follows.followerId, followeeId: follows.followeeId })
      .from(follows)
      .where(
        or(
          and(eq(follows.followerId, viewerId), inArray(follows.followeeId, targetIds)),
          and(eq(follows.followeeId, viewerId), inArray(follows.followerId, targetIds)),
        ),
      ),
    db
      .select({ blockerId: userBlocks.blockerId, blockedId: userBlocks.blockedId })
      .from(userBlocks)
      .where(
        or(
          and(eq(userBlocks.blockerId, viewerId), inArray(userBlocks.blockedId, targetIds)),
          and(eq(userBlocks.blockedId, viewerId), inArray(userBlocks.blockerId, targetIds)),
        ),
      ),
  ])

  for (const row of followRows) {
    if (row.followerId === viewerId) maps.viewerFollows.add(row.followeeId)
    else maps.followsViewer.add(row.followerId)
  }

  for (const row of blockRows) {
    if (row.blockerId === viewerId) maps.viewerBlocked.add(row.blockedId)
    else maps.blockedViewer.add(row.blockerId)
  }

  return maps
}

function factsFor(
  viewerId: string,
  target: { id: string; profile: ProfileRow | null },
  maps: RelationshipMaps,
): RelationshipFacts {
  return {
    viewerId,
    targetId: target.id,
    targetCommunityVisible: target.profile?.communityVisible ?? false,
    targetRequestPolicy: target.profile?.requestPolicy ?? "everyone",
    viewerBlockedTarget: maps.viewerBlocked.has(target.id),
    targetBlockedViewer: maps.blockedViewer.has(target.id),
    viewerFollowsTarget: maps.viewerFollows.has(target.id),
    targetFollowsViewer: maps.followsViewer.has(target.id),
  }
}

function serializeRelationship(facts: RelationshipFacts) {
  return {
    following: facts.viewerFollowsTarget,
    followsYou: facts.targetFollowsViewer,
    rallyPartner: isRallyPartner(facts),
    blockedByYou: facts.viewerBlockedTarget,
    canMessage: canMessage(facts),
  }
}

type PlayerRow = {
  id: string
  name: string
  image: string | null
  skillLevel: string
  profile: ProfileRow | null
  availability: AvailabilityRow | null
}

function serializePlayer(
  row: PlayerRow,
  facts: RelationshipFacts,
  now: Date,
  stats: CardStats = EMPTY_CARD_STATS,
) {
  const profile = serializeProfile(row.profile)
  return {
    id: row.id,
    displayName: toCommunityDisplayName(row.name),
    image: row.image,
    skillLevel: row.skillLevel,
    playStyle: profile.playStyle,
    handedness: profile.handedness,
    bio: profile.bio,
    usualTimes: profile.usualTimes,
    foundingPlayer: profile.foundingPlayer,
    availability: serializeAvailability(row.availability, now),
    relationship: serializeRelationship(facts),
    stats,
  }
}

// A session counts once it is completed, or confirmed and already over.
function playedBooking(now: Date) {
  return or(
    eq(bookings.status, "completed"),
    and(eq(bookings.status, "confirmed"), lte(bookings.endTime, now)),
  )
}

async function loadCardStats(context: TenantContext, userIds: string[], now: Date) {
  if (userIds.length === 0) {
    return new Map<string, CardStats>()
  }

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
        and(
          eq(bookings.tenantId, context.tenantId),
          inArray(bookings.userId, userIds),
          playedBooking(now),
        ),
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

  return groupCardStats(userIds, toCardStatWeeks([...owned, ...joined]), now)
}

// SQL fragment: true when either user has blocked the other.
function blockedBetween(viewerId: string) {
  return sql`exists (
    select 1 from ${userBlocks}
    where (${userBlocks.blockerId} = ${viewerId} and ${userBlocks.blockedId} = ${user.id})
       or (${userBlocks.blockerId} = ${user.id} and ${userBlocks.blockedId} = ${viewerId})
  )`
}

const activeAvailabilityJoin = (now: Date) =>
  and(
    eq(playAvailability.userId, user.id),
    isNull(playAvailability.endedAt),
    sql`${playAvailability.endsAt} > ${now}`,
  )

// --- My community ---------------------------------------------------------

async function getProfileRow(userId: string) {
  const [row] = await db
    .select()
    .from(playerProfiles)
    .where(eq(playerProfiles.userId, userId))
    .limit(1)
  return row ?? null
}

async function getActiveAvailability(userId: string, now: Date) {
  const [row] = await db
    .select()
    .from(playAvailability)
    .where(
      and(
        eq(playAvailability.userId, userId),
        isNull(playAvailability.endedAt),
        sql`${playAvailability.endsAt} > ${now}`,
      ),
    )
    .limit(1)
  return row ?? null
}

async function countConnections(userId: string) {
  const visibleFollower = and(
    eq(follows.followeeId, userId),
    eq(playerProfiles.communityVisible, true),
  )
  const visibleFollowee = and(
    eq(follows.followerId, userId),
    eq(playerProfiles.communityVisible, true),
  )

  const [[followers], [following]] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(follows)
      .innerJoin(playerProfiles, eq(playerProfiles.userId, follows.followerId))
      .where(visibleFollower),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(follows)
      .innerJoin(playerProfiles, eq(playerProfiles.userId, follows.followeeId))
      .where(visibleFollowee),
  ])

  return { followers: followers?.count ?? 0, following: following?.count ?? 0 }
}

export async function getMyCommunity(context: TenantContext, userId: string) {
  const now = new Date()
  const [[me], profile, availability, homeVenue, counts, stats] = await Promise.all([
    db
      .select({ id: user.id, name: user.name, image: user.image, skillLevel: user.skillLevel })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1),
    getProfileRow(userId),
    getActiveAvailability(userId, now),
    resolveHomeVenue(context, userId),
    countConnections(userId),
    loadCardStats(context, [userId], now),
  ])

  if (!me) {
    throw new CommunityError("PLAYER_NOT_FOUND", "We could not find your account.", 404)
  }

  return {
    id: me.id,
    displayName: toCommunityDisplayName(me.name),
    image: me.image,
    skillLevel: me.skillLevel,
    profile: serializeProfile(profile),
    availability: serializeAvailability(availability, now),
    homeVenue: homeVenue ? { id: homeVenue.id, name: homeVenue.name } : null,
    counts,
    stats: stats.get(userId) ?? EMPTY_CARD_STATS,
  }
}

async function endActiveAvailability(executor: Pick<typeof db, "update">, userId: string, now: Date) {
  await executor
    .update(playAvailability)
    .set({ endedAt: now })
    .where(and(eq(playAvailability.userId, userId), isNull(playAvailability.endedAt)))
}

export async function updateMyCommunityProfile(
  context: TenantContext,
  userId: string,
  patch: CommunityProfilePatch,
) {
  const now = new Date()

  await db.transaction(async (tx) => {
    await tx
      .insert(playerProfiles)
      .values({ userId, tenantId: context.tenantId, ...patch })
      .onConflictDoUpdate({ target: playerProfiles.userId, set: { ...patch, updatedAt: now } })

    if (patch.communityVisible === false) {
      await endActiveAvailability(tx, userId, now)
    }
  })

  return getMyCommunity(context, userId)
}

// --- Open to play ---------------------------------------------------------

export async function goOpenToPlay(
  context: TenantContext,
  userId: string,
  input: CommunityAvailabilityInput,
) {
  const profile = await getProfileRow(userId)

  if (!profile?.communityVisible) {
    throw new CommunityError(
      "COMMUNITY_PROFILE_REQUIRED",
      "Create your community card before going open to play.",
      409,
    )
  }

  assertRateLimit("availability", userId)

  const venue = await requireHomeVenue(context, userId)
  const now = new Date()
  const resolved = resolveAvailabilityWindow(
    input.window as PlayAvailabilityWindow,
    now,
    venue.timezone,
  )

  if (!resolved.ok) {
    throw new CommunityError(resolved.code, resolved.message, 409)
  }

  await db.transaction(async (tx) => {
    await endActiveAvailability(tx, userId, now)
    await tx.insert(playAvailability).values({
      tenantId: context.tenantId,
      userId,
      locationId: venue.id,
      window: input.window,
      startsAt: resolved.range.startsAt,
      endsAt: resolved.range.endsAt,
      note: input.note ?? null,
      lookingForDoubles: input.lookingForDoubles ?? false,
    })
  })

  return getMyCommunity(context, userId)
}

export async function stopOpenToPlay(context: TenantContext, userId: string) {
  await endActiveAvailability(db, userId, new Date())
  return getMyCommunity(context, userId)
}

// --- Players --------------------------------------------------------------

export async function listCommunityPlayers(
  context: TenantContext,
  viewerId: string,
  query: CommunityPlayersQuery,
) {
  const now = new Date()
  const venue = await requireHomeVenue(context, viewerId)
  const fallback = await firstActiveLocation(context)
  const offset = decodeCursor(query.cursor)
  const pageSize = COMMUNITY_LIMITS.pageSize

  const conditions = [
    eq(playerProfiles.tenantId, context.tenantId),
    eq(playerProfiles.communityVisible, true),
    sql`${user.id} <> ${viewerId}`,
    sql`not ${blockedBetween(viewerId)}`,
    or(
      sql`coalesce(${user.defaultLocationId}, ${fallback?.id ?? null}::uuid) = ${venue.id}::uuid`,
      eq(playAvailability.locationId, venue.id),
    ),
  ]

  if (query.status === "open") {
    conditions.push(sql`${playAvailability.id} is not null`)
  }

  if (query.skill) {
    conditions.push(eq(user.skillLevel, query.skill))
  }

  if (query.doubles) {
    conditions.push(eq(playAvailability.lookingForDoubles, true))
  }

  if (query.following) {
    conditions.push(sql`exists (
      select 1 from ${follows}
      where ${follows.followerId} = ${viewerId} and ${follows.followeeId} = ${user.id}
    )`)
  }

  const rows = await db
    .select({
      id: user.id,
      name: user.name,
      image: user.image,
      skillLevel: user.skillLevel,
      profile: playerProfiles,
      availability: playAvailability,
    })
    .from(playerProfiles)
    .innerJoin(user, eq(user.id, playerProfiles.userId))
    .leftJoin(playAvailability, activeAvailabilityJoin(now))
    .where(and(...conditions))
    .orderBy(
      sql`case
        when ${playAvailability.id} is not null and ${playAvailability.startsAt} <= ${now} then 0
        when ${playAvailability.id} is not null then 1
        else 2
      end`,
      asc(playAvailability.startsAt),
      asc(user.name),
      asc(user.id),
    )
    .limit(pageSize + 1)
    .offset(offset)

  const page = rows.slice(0, pageSize)
  const ids = page.map((row) => row.id)
  const [maps, stats] = await Promise.all([
    loadRelationships(viewerId, ids),
    loadCardStats(context, ids, now),
  ])

  return {
    venue: { id: venue.id, name: venue.name },
    players: page.map((row) =>
      serializePlayer(row, factsFor(viewerId, row, maps), now, stats.get(row.id)),
    ),
    nextCursor: rows.length > pageSize ? encodeCursor(offset + pageSize) : null,
  }
}

async function loadPlayerRow(context: TenantContext, targetId: string, now: Date) {
  const [row] = await db
    .select({
      id: user.id,
      name: user.name,
      image: user.image,
      skillLevel: user.skillLevel,
      profile: playerProfiles,
      availability: playAvailability,
    })
    .from(user)
    .leftJoin(
      playerProfiles,
      and(eq(playerProfiles.userId, user.id), eq(playerProfiles.tenantId, context.tenantId)),
    )
    .leftJoin(playAvailability, activeAvailabilityJoin(now))
    .where(eq(user.id, targetId))
    .limit(1)

  return row ?? null
}

// Loads a target the viewer may see, or throws PLAYER_NOT_FOUND (blocked and
// hidden players look identical to missing ones).
async function requireVisiblePlayer(context: TenantContext, viewerId: string, targetId: string) {
  const now = new Date()
  const row = await loadPlayerRow(context, targetId, now)
  const maps = await loadRelationships(viewerId, row ? [row.id] : [])
  const facts = row ? factsFor(viewerId, row, maps) : null

  if (!row || !facts || !canSee(facts)) {
    throw new CommunityError("PLAYER_NOT_FOUND", "We could not find that player.", 404)
  }

  return { row, facts, now }
}

export async function getCommunityPlayer(context: TenantContext, viewerId: string, targetId: string) {
  const { row, facts, now } = await requireVisiblePlayer(context, viewerId, targetId)
  const [counts, homeVenue, stats] = await Promise.all([
    countConnections(row.id),
    resolveHomeVenue(context, row.id),
    loadCardStats(context, [row.id], now),
  ])

  return {
    player: {
      ...serializePlayer(row, facts, now, stats.get(row.id)),
      homeVenue: homeVenue ? { id: homeVenue.id, name: homeVenue.name } : null,
      counts,
    },
  }
}

// --- Follows --------------------------------------------------------------

function assertNotSelf(viewerId: string, targetId: string) {
  if (viewerId === targetId) {
    throw new CommunityError("CANNOT_TARGET_SELF", "You can't do that to yourself.")
  }
}

export async function followPlayer(context: TenantContext, viewerId: string, targetId: string) {
  assertNotSelf(viewerId, targetId)
  await requireVisiblePlayer(context, viewerId, targetId)
  assertRateLimit("follow", viewerId)

  await db
    .insert(follows)
    .values({ tenantId: context.tenantId, followerId: viewerId, followeeId: targetId })
    .onConflictDoNothing()

  return getCommunityPlayer(context, viewerId, targetId)
}

export async function unfollowPlayer(context: TenantContext, viewerId: string, targetId: string) {
  assertNotSelf(viewerId, targetId)

  await db
    .delete(follows)
    .where(and(eq(follows.followerId, viewerId), eq(follows.followeeId, targetId)))

  return { following: false }
}

export async function listConnections(
  context: TenantContext,
  viewerId: string,
  targetId: string,
  kind: "followers" | "following",
  cursor: string | undefined,
) {
  await requireVisiblePlayer(context, viewerId, targetId)

  const now = new Date()
  const offset = decodeCursor(cursor)
  const pageSize = COMMUNITY_LIMITS.pageSize
  const otherSide = kind === "followers" ? follows.followerId : follows.followeeId
  const targetSide = kind === "followers" ? follows.followeeId : follows.followerId

  const rows = await db
    .select({
      id: user.id,
      name: user.name,
      image: user.image,
      skillLevel: user.skillLevel,
      profile: playerProfiles,
      availability: playAvailability,
    })
    .from(follows)
    .innerJoin(user, eq(user.id, otherSide))
    .innerJoin(playerProfiles, eq(playerProfiles.userId, user.id))
    .leftJoin(playAvailability, activeAvailabilityJoin(now))
    .where(
      and(
        eq(targetSide, targetId),
        eq(playerProfiles.tenantId, context.tenantId),
        eq(playerProfiles.communityVisible, true),
        sql`not ${blockedBetween(viewerId)}`,
      ),
    )
    .orderBy(desc(follows.createdAt), asc(user.id))
    .limit(pageSize + 1)
    .offset(offset)

  const page = rows.slice(0, pageSize)
  const ids = page.map((row) => row.id)
  const [maps, stats] = await Promise.all([
    loadRelationships(viewerId, ids),
    loadCardStats(context, ids, now),
  ])

  return {
    players: page.map((row) =>
      serializePlayer(row, factsFor(viewerId, row, maps), now, stats.get(row.id)),
    ),
    nextCursor: rows.length > pageSize ? encodeCursor(offset + pageSize) : null,
  }
}

// --- Moderation -----------------------------------------------------------

async function requireUserExists(targetId: string) {
  const [row] = await db.select({ id: user.id }).from(user).where(eq(user.id, targetId)).limit(1)
  if (!row) {
    throw new CommunityError("PLAYER_NOT_FOUND", "We could not find that player.", 404)
  }
}

export async function blockPlayer(context: TenantContext, viewerId: string, targetId: string) {
  assertNotSelf(viewerId, targetId)
  await requireUserExists(targetId)

  await db.transaction(async (tx) => {
    await tx
      .insert(userBlocks)
      .values({ tenantId: context.tenantId, blockerId: viewerId, blockedId: targetId })
      .onConflictDoNothing()
    await tx
      .delete(follows)
      .where(
        or(
          and(eq(follows.followerId, viewerId), eq(follows.followeeId, targetId)),
          and(eq(follows.followerId, targetId), eq(follows.followeeId, viewerId)),
        ),
      )
  })

  return { blocked: true }
}

export async function unblockPlayer(_context: TenantContext, viewerId: string, targetId: string) {
  assertNotSelf(viewerId, targetId)

  await db
    .delete(userBlocks)
    .where(and(eq(userBlocks.blockerId, viewerId), eq(userBlocks.blockedId, targetId)))

  return { blocked: false }
}

export async function createCommunityReport(
  context: TenantContext,
  reporterId: string,
  input: CommunityReportInput,
) {
  assertNotSelf(reporterId, input.targetUserId)
  await requireUserExists(input.targetUserId)
  assertRateLimit("report", reporterId)

  const [report] = await db
    .insert(communityReports)
    .values({
      tenantId: context.tenantId,
      reporterId,
      targetUserId: input.targetUserId,
      messageId: input.messageId ?? null,
      reason: input.reason,
      note: input.note ?? null,
    })
    .returning({ id: communityReports.id, createdAt: communityReports.createdAt })

  return { report: { id: report.id, createdAt: report.createdAt.toISOString() } }
}
