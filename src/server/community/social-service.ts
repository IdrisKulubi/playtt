// M4 social loop (docs/community/README.md): at the venue now, Rally
// Partners, shared bookings (join / leave), kudos.

import { and, desc, eq, gt, inArray, isNull, ne, sql } from "drizzle-orm"
import { alias } from "drizzle-orm/pg-core"

import db from "@/db/drizzle"
import {
  bookings,
  communityBookingPartners,
  communityKudos,
  communityMessages,
  follows,
  locations,
  playerProfiles,
  playSessions,
  resources,
  sessionParticipants,
  user,
  userBlocks,
} from "@/db/schema"
import type { TenantContext } from "@/server/tenancy/types"

import { EMPTY_CARD_DATA, loadCardData } from "./card-data.ts"
import { insertServerMessage } from "./chat-messages.ts"
import { loadBookingMatches } from "./match-service.ts"
import { loadPlayerRows, requireConversation } from "./chat-service.ts"
import { SOCIAL_LIMITS, type KudosType } from "./constants.ts"
import { toCommunityDisplayName } from "./display-name.ts"
import { CommunityError } from "./errors.ts"
import { deliverCommunityNotificationSoon, enqueueCommunityNotification } from "./notify.ts"
import {
  assertNotMuted,
  factsFor,
  getProfileRow,
  loadRelationships,
  requireHomeVenue,
  serializePlayer,
  type PlayerRow,
} from "./service.ts"
import { decideJoin, kudosWindow } from "./social-rules.ts"
import { canSee } from "./visibility.ts"

const otherPartner = alias(communityBookingPartners, "other_partner")

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function bookingNotFound(): never {
  throw new CommunityError("BOOKING_NOT_JOINABLE", "We could not find that booking.", 404)
}

async function visiblePlayers(context: TenantContext, viewerId: string, ids: string[], now: Date) {
  const unique = [...new Set(ids)].filter((id) => id !== viewerId)
  const [rows, maps] = await Promise.all([
    loadPlayerRows(context, unique, now),
    loadRelationships(viewerId, unique),
  ])

  const visible: { row: PlayerRow; facts: ReturnType<typeof factsFor> }[] = []
  for (const id of unique) {
    const row = rows.get(id)
    if (!row) continue
    const facts = factsFor(viewerId, row, maps)
    if (canSee(facts)) visible.push({ row, facts })
  }
  return visible
}

// --- At the venue now ---------------------------------------------------

export async function listAtVenue(context: TenantContext, viewerId: string) {
  const now = new Date()
  const venue = await requireHomeVenue(context, viewerId)

  const rows = await db
    .selectDistinct({ userId: sessionParticipants.userId })
    .from(sessionParticipants)
    .innerJoin(playSessions, eq(playSessions.id, sessionParticipants.playSessionId))
    .innerJoin(
      playerProfiles,
      and(eq(playerProfiles.userId, sessionParticipants.userId), eq(playerProfiles.tenantId, context.tenantId)),
    )
    .where(
      and(
        eq(playSessions.tenantId, context.tenantId),
        eq(playSessions.locationId, venue.id),
        inArray(playSessions.status, ["preparing", "active", "ending"]),
        // Opt-in only: showAtVenue defaults to off.
        eq(playerProfiles.showAtVenue, true),
        eq(playerProfiles.communityVisible, true),
        ne(sessionParticipants.userId, viewerId),
      ),
    )

  const visible = await visiblePlayers(context, viewerId, rows.map((row) => row.userId), now)
  const cards = await loadCardData(context, visible.map((entry) => entry.row.id), now)

  return {
    venue: { id: venue.id, name: venue.name },
    count: visible.length,
    players: visible.map(({ row, facts }) => serializePlayer(row, facts, now, cards.get(row.id))),
  }
}

// --- Rally Partners -------------------------------------------------------

export async function listRallyPartners(context: TenantContext, viewerId: string) {
  const now = new Date()
  const followedBack = alias(follows, "followed_back")

  const [mutual, shared] = await Promise.all([
    db
      .select({ userId: follows.followeeId })
      .from(follows)
      .innerJoin(
        followedBack,
        and(eq(followedBack.followerId, follows.followeeId), eq(followedBack.followeeId, viewerId)),
      )
      .where(eq(follows.followerId, viewerId)),
    db
      .select({
        userId: otherPartner.userId,
        lastPlayed: sql<Date>`max(${bookings.startTime})`,
      })
      .from(communityBookingPartners)
      .innerJoin(otherPartner, eq(otherPartner.bookingId, communityBookingPartners.bookingId))
      .innerJoin(bookings, eq(bookings.id, communityBookingPartners.bookingId))
      .where(
        and(
          eq(communityBookingPartners.tenantId, context.tenantId),
          eq(communityBookingPartners.userId, viewerId),
          ne(otherPartner.userId, viewerId),
          isNull(communityBookingPartners.leftAt),
          isNull(otherPartner.leftAt),
          ne(bookings.status, "cancelled"),
        ),
      )
      .groupBy(otherPartner.userId),
  ])

  const lastPlayed = new Map(shared.map((row) => [row.userId, new Date(row.lastPlayed).getTime()]))
  const visible = await visiblePlayers(
    context,
    viewerId,
    [...mutual.map((row) => row.userId), ...shared.map((row) => row.userId)],
    now,
  )

  const players = visible
    .map(({ row, facts }) => serializePlayer(row, facts, now, EMPTY_CARD_DATA))
    .sort((a, b) => {
      const openA = a.availability?.openNow ? 0 : 1
      const openB = b.availability?.openNow ? 0 : 1
      if (openA !== openB) return openA - openB
      const playedA = lastPlayed.get(a.id) ?? 0
      const playedB = lastPlayed.get(b.id) ?? 0
      if (playedA !== playedB) return playedB - playedA
      return a.displayName.localeCompare(b.displayName)
    })
    .slice(0, SOCIAL_LIMITS.rallyPartnersMax)

  return { players }
}

// --- Shared bookings ------------------------------------------------------

async function loadBooking(context: TenantContext, bookingId: string) {
  if (!UUID_PATTERN.test(bookingId)) bookingNotFound()

  const [row] = await db
    .select({
      id: bookings.id,
      hostId: bookings.userId,
      status: bookings.status,
      startTime: bookings.startTime,
      endTime: bookings.endTime,
      groupSize: bookings.groupSize,
      resourceName: resources.name,
      locationName: locations.name,
      playSessionId: playSessions.id,
      sessionEndedAt: playSessions.endedAt,
    })
    .from(bookings)
    .innerJoin(resources, eq(resources.id, bookings.resourceId))
    .innerJoin(locations, eq(locations.id, bookings.locationId))
    .leftJoin(playSessions, eq(playSessions.bookingId, bookings.id))
    .where(and(eq(bookings.id, bookingId), eq(bookings.tenantId, context.tenantId)))
    .limit(1)

  if (!row) bookingNotFound()
  return row
}

function nairobiWhen(date: Date) {
  const local = new Date(date.getTime() + 3 * 60 * 60 * 1000)
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
  const hours = local.getUTCHours()
  const minutes = local.getUTCMinutes()
  const clock = `${hours % 12 === 0 ? 12 : hours % 12}${minutes ? `:${String(minutes).padStart(2, "0")}` : ""}${hours < 12 ? "AM" : "PM"}`
  return `${days[local.getUTCDay()]} ${clock}`
}

/** Join a host's booking from a booking card they shared in your chat. */
export async function joinSharedBooking(
  context: TenantContext,
  viewerId: string,
  bookingId: string,
  input: { conversationId: string },
) {
  const now = new Date()
  const frame = await requireConversation(context, viewerId, input.conversationId, now)
  const booking = await loadBooking(context, bookingId)
  assertNotMuted(await getProfileRow(viewerId))

  if (booking.hostId === viewerId) {
    throw new CommunityError("BOOKING_NOT_JOINABLE", "You're the host of this booking.", 409)
  }

  // Only the host's own booking card, in this chat, lets you join.
  const [card] = await db
    .select({ id: communityMessages.id })
    .from(communityMessages)
    .where(
      and(
        eq(communityMessages.conversationId, input.conversationId),
        eq(communityMessages.kind, "booking_card"),
        eq(communityMessages.senderId, booking.hostId),
        sql`${communityMessages.payload} ->> 'bookingId' = ${bookingId}`,
      ),
    )
    .limit(1)

  if (!card || frame.other.userId !== booking.hostId) bookingNotFound()

  if (!booking.playSessionId) {
    throw new CommunityError("BOOKING_NOT_JOINABLE", "This booking isn't ready yet. Try again shortly.", 409)
  }
  const playSessionId = booking.playSessionId

  const joined = await db.transaction(async (tx) => {
    // Serialise joins per booking so two people can't take the last seat.
    await tx.execute(sql`select id from ${bookings} where id = ${bookingId} for update`)

    const partners = await tx
      .select({ userId: communityBookingPartners.userId, leftAt: communityBookingPartners.leftAt })
      .from(communityBookingPartners)
      .where(eq(communityBookingPartners.bookingId, bookingId))

    const active = partners.filter((partner) => !partner.leftAt)
    const decision = decideJoin({
      bookingStatus: booking.status,
      startTime: booking.startTime,
      groupSize: booking.groupSize,
      activePartners: active.some((partner) => partner.userId === booking.hostId) ? active.length : active.length + 1,
      alreadyJoined: active.some((partner) => partner.userId === viewerId),
      now,
    })

    if (!decision.ok) {
      throw new CommunityError(decision.code, decision.reason, 409)
    }

    if (active.some((partner) => partner.userId === viewerId)) return false

    await tx
      .insert(communityBookingPartners)
      .values({
        tenantId: context.tenantId,
        bookingId,
        userId: booking.hostId,
        role: "owner",
        conversationId: input.conversationId,
      })
      .onConflictDoNothing()

    await tx
      .insert(communityBookingPartners)
      .values({
        tenantId: context.tenantId,
        bookingId,
        userId: viewerId,
        role: "guest",
        conversationId: input.conversationId,
      })
      .onConflictDoUpdate({
        target: [communityBookingPartners.bookingId, communityBookingPartners.userId],
        set: { leftAt: null, joinedAt: now, conversationId: input.conversationId },
      })

    await tx
      .insert(sessionParticipants)
      .values({ tenantId: context.tenantId, playSessionId, userId: viewerId, role: "guest" })
      .onConflictDoNothing()

    const name = toCommunityDisplayName(await nameOf(viewerId))
    const message = await insertServerMessage(tx, {
      tenantId: context.tenantId,
      conversationId: input.conversationId,
      kind: "system",
      body: `${name} is in for ${nairobiWhen(booking.startTime)} 🏓`,
      payload: { bookingId, event: "joined", userId: viewerId },
    })
    await enqueueCommunityNotification(
      context.tenantId,
      { kind: "message", conversationId: input.conversationId, messageId: message.id, senderId: viewerId },
      tx,
    )
    return message.id
  })

  if (joined) {
    deliverCommunityNotificationSoon(context.tenantId, {
      kind: "message",
      conversationId: input.conversationId,
      messageId: joined,
      senderId: viewerId,
    })
  }

  return listMySharedBookings(context, viewerId)
}

async function nameOf(userId: string) {
  const [row] = await db.select({ name: user.name }).from(user).where(eq(user.id, userId)).limit(1)
  return row?.name ?? null
}

/** A guest pulls out. Less than 2 h before the start counts against reliability. */
export async function leaveSharedBooking(context: TenantContext, viewerId: string, bookingId: string) {
  const now = new Date()
  const booking = await loadBooking(context, bookingId)

  const [partner] = await db
    .select()
    .from(communityBookingPartners)
    .where(
      and(
        eq(communityBookingPartners.bookingId, bookingId),
        eq(communityBookingPartners.userId, viewerId),
        isNull(communityBookingPartners.leftAt),
      ),
    )
    .limit(1)

  if (!partner || partner.role !== "guest") bookingNotFound()

  if (booking.startTime <= now) {
    throw new CommunityError("BOOKING_NOT_JOINABLE", "This game has already started.", 409)
  }

  const messageId = await db.transaction(async (tx) => {
    await tx
      .update(communityBookingPartners)
      .set({ leftAt: now })
      .where(eq(communityBookingPartners.id, partner.id))

    if (booking.playSessionId) {
      await tx
        .delete(sessionParticipants)
        .where(
          and(
            eq(sessionParticipants.playSessionId, booking.playSessionId),
            eq(sessionParticipants.userId, viewerId),
            eq(sessionParticipants.role, "guest"),
          ),
        )
    }

    if (!partner.conversationId) return null
    const message = await insertServerMessage(tx, {
      tenantId: context.tenantId,
      conversationId: partner.conversationId,
      kind: "system",
      body: `${toCommunityDisplayName(await nameOf(viewerId))} can't make ${nairobiWhen(booking.startTime)} anymore`,
      payload: { bookingId, event: "left", userId: viewerId },
    })
    await enqueueCommunityNotification(
      context.tenantId,
      { kind: "message", conversationId: partner.conversationId, messageId: message.id, senderId: viewerId },
      tx,
    )
    return message.id
  })

  if (messageId && partner.conversationId) {
    deliverCommunityNotificationSoon(context.tenantId, {
      kind: "message",
      conversationId: partner.conversationId,
      messageId,
      senderId: viewerId,
    })
  }

  return listMySharedBookings(context, viewerId)
}

/**
 * Bookings I'm playing with someone through Community: upcoming ones and
 * those still inside the 72 h kudos window.
 */
export async function listMySharedBookings(context: TenantContext, viewerId: string) {
  const now = new Date()
  const since = new Date(now.getTime() - SOCIAL_LIMITS.kudosWindowMs)

  const mine = await db
    .select({
      bookingId: communityBookingPartners.bookingId,
      role: communityBookingPartners.role,
      conversationId: communityBookingPartners.conversationId,
    })
    .from(communityBookingPartners)
    .innerJoin(bookings, eq(bookings.id, communityBookingPartners.bookingId))
    .where(
      and(
        eq(communityBookingPartners.tenantId, context.tenantId),
        eq(communityBookingPartners.userId, viewerId),
        isNull(communityBookingPartners.leftAt),
        ne(bookings.status, "cancelled"),
        gt(bookings.endTime, since),
      ),
    )
    .orderBy(desc(bookings.startTime))

  if (mine.length === 0) return { bookings: [] }

  const bookingIds = mine.map((row) => row.bookingId)
  const [details, partners, given, matchInfo] = await Promise.all([
    db
      .select({
        id: bookings.id,
        hostId: bookings.userId,
        startTime: bookings.startTime,
        endTime: bookings.endTime,
        status: bookings.status,
        resourceName: resources.name,
        locationName: locations.name,
        sessionStatus: playSessions.status,
        sessionEndedAt: playSessions.endedAt,
      })
      .from(bookings)
      .innerJoin(resources, eq(resources.id, bookings.resourceId))
      .innerJoin(locations, eq(locations.id, bookings.locationId))
      .leftJoin(playSessions, eq(playSessions.bookingId, bookings.id))
      .where(inArray(bookings.id, bookingIds)),
    db
      .select({ bookingId: communityBookingPartners.bookingId, userId: communityBookingPartners.userId })
      .from(communityBookingPartners)
      .where(
        and(
          inArray(communityBookingPartners.bookingId, bookingIds),
          isNull(communityBookingPartners.leftAt),
          ne(communityBookingPartners.userId, viewerId),
        ),
      ),
    db
      .select({
        bookingId: communityKudos.bookingId,
        receiverId: communityKudos.receiverId,
        type: communityKudos.type,
      })
      .from(communityKudos)
      .where(and(inArray(communityKudos.bookingId, bookingIds), eq(communityKudos.giverId, viewerId))),
    loadBookingMatches(bookingIds),
  ])

  const visible = await visiblePlayers(context, viewerId, partners.map((row) => row.userId), now)
  const playerById = new Map(
    visible.map(({ row, facts }) => [row.id, serializePlayer(row, facts, now, EMPTY_CARD_DATA)]),
  )
  const detailById = new Map(details.map((row) => [row.id, row]))

  return {
    bookings: mine
      .map((entry) => {
        const detail = detailById.get(entry.bookingId)
        if (!detail) return null
        const endedAt = detail.sessionEndedAt ?? detail.endTime
        const partnerPlayers = partners
          .filter((row) => row.bookingId === entry.bookingId)
          .map((row) => playerById.get(row.userId))
          .filter((player): player is NonNullable<typeof player> => Boolean(player))

        // Blocked or hidden partners drop out; nothing left to show.
        if (partnerPlayers.length === 0) return null

        const kudosGiven: Record<string, KudosType[]> = {}
        for (const row of given.filter((kudos) => kudos.bookingId === entry.bookingId)) {
          ;(kudosGiven[row.receiverId] ??= []).push(row.type)
        }

        return {
          bookingId: entry.bookingId,
          role: entry.role,
          hostId: detail.hostId,
          conversationId: entry.conversationId,
          startsAt: detail.startTime.toISOString(),
          endsAt: detail.endTime.toISOString(),
          resourceName: detail.resourceName,
          locationName: detail.locationName,
          phase: detail.startTime > now ? "upcoming" : endedAt > now ? "live" : "ended",
          kudosOpen: kudosWindow(endedAt, now) === "open",
          partners: partnerPlayers,
          kudosGiven,
          // Scoreboard result + who played which side (M5); null before any score.
          match: matchInfo.get(entry.bookingId) ?? null,
        }
      })
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry)),
  }
}

// --- Kudos ----------------------------------------------------------------

export async function giveKudos(
  context: TenantContext,
  viewerId: string,
  bookingId: string,
  input: { receiverId: string; types: KudosType[] },
) {
  const now = new Date()
  const booking = await loadBooking(context, bookingId)
  const notAllowed = (message: string): never => {
    throw new CommunityError("KUDOS_NOT_ALLOWED", message, 409)
  }

  if (input.receiverId === viewerId) notAllowed("Kudos are for the people you played with.")

  const partners = await db
    .select({ userId: communityBookingPartners.userId })
    .from(communityBookingPartners)
    .where(
      and(
        eq(communityBookingPartners.bookingId, bookingId),
        inArray(communityBookingPartners.userId, [viewerId, input.receiverId]),
        isNull(communityBookingPartners.leftAt),
      ),
    )

  if (booking.status === "cancelled" || partners.length < 2) {
    notAllowed("Only players on the same booking can give each other kudos.")
  }

  const window = kudosWindow(booking.sessionEndedAt ?? booking.endTime, now)
  if (window === "not_yet") notAllowed("Kudos open once your session ends.")
  if (window === "closed") notAllowed("Kudos close 72 hours after the match.")

  const blocked = await db
    .select({ id: userBlocks.id })
    .from(userBlocks)
    .where(
      sql`(${userBlocks.blockerId} = ${viewerId} and ${userBlocks.blockedId} = ${input.receiverId})
        or (${userBlocks.blockerId} = ${input.receiverId} and ${userBlocks.blockedId} = ${viewerId})`,
    )
    .limit(1)
  if (blocked.length > 0) notAllowed("Only players on the same booking can give each other kudos.")

  const existing = await db
    .select({ type: communityKudos.type })
    .from(communityKudos)
    .where(
      and(
        eq(communityKudos.bookingId, bookingId),
        eq(communityKudos.giverId, viewerId),
        eq(communityKudos.receiverId, input.receiverId),
      ),
    )
  const already = new Set(existing.map((row) => row.type))
  const fresh = [...new Set(input.types)].filter((type) => !already.has(type))

  if (already.size + fresh.length > SOCIAL_LIMITS.maxKudosTypesPerMatch) {
    notAllowed(`Pick up to ${SOCIAL_LIMITS.maxKudosTypesPerMatch} kudos per match.`)
  }

  if (fresh.length > 0) {
    const event = { kind: "kudos" as const, bookingId, giverId: viewerId, receiverId: input.receiverId, types: fresh }
    await db.transaction(async (tx) => {
      await tx
        .insert(communityKudos)
        .values(
          fresh.map((type) => ({
            tenantId: context.tenantId,
            bookingId,
            giverId: viewerId,
            receiverId: input.receiverId,
            type,
          })),
        )
        .onConflictDoNothing()
      await enqueueCommunityNotification(context.tenantId, event, tx)
    })
    deliverCommunityNotificationSoon(context.tenantId, event)
  }

  return listMySharedBookings(context, viewerId)
}
