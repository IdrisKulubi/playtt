// Group chats (docs/community/README.md, M5): doubles groups that form around
// an open-to-play window, and events ops create from the admin console.

import { and, asc, desc, eq, gt, inArray, isNull, lt, ne, or, sql } from "drizzle-orm"

import db from "@/db/drizzle"
import {
  communityConversationMembers,
  communityConversations,
  communityMessages,
  playAvailability,
  user,
  userBlocks,
} from "@/db/schema"
import type { TenantContext } from "@/server/tenancy/types"

import { EMPTY_CARD_DATA } from "./card-data.ts"
import { insertServerMessage } from "./chat-messages.ts"
export { loadDoublesSpots } from "./chat-messages.ts"
import { buildContent, findByClientId, loadPlayerRows, serializeMessage } from "./chat-service.ts"
import { CHAT_LIMITS } from "./constants.ts"
import { toCommunityDisplayName } from "./display-name.ts"
import { CommunityError } from "./errors.ts"
import type { CommunityMessageInput } from "./http.ts"
import { deliverCommunityNotificationSoon, enqueueCommunityNotification } from "./notify.ts"
import { decideGroupJoin, GROUP_LIMITS } from "./rating-rules.ts"
import {
  assertNotMuted,
  assertRateLimit,
  factsFor,
  getProfileRow,
  loadRelationships,
  requireHomeVenue,
  requireVisiblePlayer,
  serializePlayer,
} from "./service.ts"
import { canSee } from "./visibility.ts"

type ConversationRow = typeof communityConversations.$inferSelect
type MemberRow = typeof communityConversationMembers.$inferSelect

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function groupNotFound(): never {
  throw new CommunityError("CONVERSATION_NOT_FOUND", "We could not find that group.", 404)
}

function groupFull(): never {
  throw new CommunityError("BOOKING_FULL", "This group is full.", 409)
}

async function requireCardHolder(viewerId: string) {
  const profile = await getProfileRow(viewerId)
  if (!profile?.communityVisible) {
    throw new CommunityError("COMMUNITY_PROFILE_REQUIRED", "Create your community card first.", 409)
  }
  assertNotMuted(profile)
}

async function nameOf(userId: string) {
  const [row] = await db.select({ name: user.name }).from(user).where(eq(user.id, userId)).limit(1)
  return toCommunityDisplayName(row?.name)
}

async function activeMemberCount(executor: Pick<typeof db, "select">, conversationId: string) {
  const [row] = await executor
    .select({ count: sql<number>`count(*)::int` })
    .from(communityConversationMembers)
    .where(
      and(
        eq(communityConversationMembers.conversationId, conversationId),
        eq(communityConversationMembers.state, "active"),
      ),
    )
  return row?.count ?? 0
}

/** Players I blocked: their group messages are hidden from me. */
async function blockedByMe(viewerId: string) {
  const rows = await db
    .select({ id: userBlocks.blockedId })
    .from(userBlocks)
    .where(eq(userBlocks.blockerId, viewerId))
  return new Set(rows.map((row) => row.id))
}

type GroupFrame = { conversation: ConversationRow; me: MemberRow }

async function requireGroup(context: TenantContext, viewerId: string, conversationId: string): Promise<GroupFrame> {
  if (!UUID_PATTERN.test(conversationId)) groupNotFound()

  const [row] = await db
    .select({ conversation: communityConversations, me: communityConversationMembers })
    .from(communityConversations)
    .innerJoin(
      communityConversationMembers,
      and(
        eq(communityConversationMembers.conversationId, communityConversations.id),
        eq(communityConversationMembers.userId, viewerId),
      ),
    )
    .where(
      and(
        eq(communityConversations.id, conversationId),
        eq(communityConversations.tenantId, context.tenantId),
        ne(communityConversations.type, "direct"),
      ),
    )
    .limit(1)

  if (!row || row.me.state !== "active") groupNotFound()
  return row
}

async function summarizeGroup(context: TenantContext, viewerId: string, frame: GroupFrame) {
  const now = new Date()
  const conversationId = frame.conversation.id
  const [members, [last], [unread], blocked] = await Promise.all([
    db
      .select({ userId: communityConversationMembers.userId, role: communityConversationMembers.role })
      .from(communityConversationMembers)
      .where(
        and(
          eq(communityConversationMembers.conversationId, conversationId),
          eq(communityConversationMembers.state, "active"),
        ),
      )
      .orderBy(asc(communityConversationMembers.joinedAt)),
    db
      .select()
      .from(communityMessages)
      .where(eq(communityMessages.conversationId, conversationId))
      .orderBy(desc(communityMessages.seq))
      .limit(1),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(communityMessages)
      .where(
        and(
          eq(communityMessages.conversationId, conversationId),
          gt(communityMessages.seq, frame.me.lastReadSeq),
          sql`${communityMessages.senderId} is distinct from ${viewerId}`,
        ),
      ),
    blockedByMe(viewerId),
  ])

  const otherIds = members.map((member) => member.userId).filter((id) => id !== viewerId)
  const [rows, maps] = await Promise.all([loadPlayerRows(context, otherIds, now), loadRelationships(viewerId, otherIds)])
  const players = otherIds.flatMap((id) => {
    const row = rows.get(id)
    if (!row) return []
    const facts = factsFor(viewerId, row, maps)
    // Hidden or blocked members are left out of my view of the group.
    if (!canSee(facts)) return []
    return [{ ...serializePlayer(row, facts, now, EMPTY_CARD_DATA), groupRole: members.find((m) => m.userId === id)?.role }]
  })

  return {
    id: conversationId,
    type: frame.conversation.type as "group" | "event",
    title: frame.conversation.title ?? "Group",
    description: frame.conversation.description,
    startsAt: frame.conversation.startsAt?.toISOString() ?? null,
    maxMembers: frame.conversation.maxMembers,
    memberCount: members.length,
    members: players,
    myRole: frame.me.role,
    mutedUntil: frame.me.mutedUntil && frame.me.mutedUntil > now ? frame.me.mutedUntil.toISOString() : null,
    closed: Boolean(frame.conversation.closedAt),
    lastMessage: last && !(last.senderId && blocked.has(last.senderId)) ? serializeMessage(last, viewerId) : null,
    unreadCount: unread?.count ?? 0,
  }
}

async function addMember(
  context: TenantContext,
  conversationId: string,
  userId: string,
  maxMembers: number,
  closed: boolean,
) {
  const now = new Date()
  return db.transaction(async (tx) => {
    // Serialise joins so two players can't take the last spot.
    await tx.execute(sql`select id from ${communityConversations} where id = ${conversationId} for update`)

    const [existing] = await tx
      .select()
      .from(communityConversationMembers)
      .where(
        and(
          eq(communityConversationMembers.conversationId, conversationId),
          eq(communityConversationMembers.userId, userId),
        ),
      )
      .limit(1)

    const decision = decideGroupJoin({
      activeMembers: await activeMemberCount(tx, conversationId),
      maxMembers,
      alreadyMember: existing?.state === "active",
      closed,
    })
    if (!decision.ok) {
      if (decision.reason === "FULL") groupFull()
      throw new CommunityError("BOOKING_NOT_JOINABLE", "This group is closed.", 409)
    }
    if (existing?.state === "active") return null

    await tx
      .insert(communityConversationMembers)
      .values({ conversationId, tenantId: context.tenantId, userId, state: "active", acceptedAt: now })
      .onConflictDoUpdate({
        target: [communityConversationMembers.conversationId, communityConversationMembers.userId],
        set: { state: "active", acceptedAt: now, joinedAt: now },
      })

    const count = await activeMemberCount(tx, conversationId)
    const message = await insertServerMessage(tx, {
      tenantId: context.tenantId,
      conversationId,
      kind: "system",
      body: `${await nameOf(userId)} joined (${count}/${maxMembers})`,
      payload: { event: "joined", userId },
    })
    await enqueueCommunityNotification(
      context.tenantId,
      { kind: "message", conversationId, messageId: message.id, senderId: userId },
      tx,
    )
    return message.id
  })
}

// --- Doubles --------------------------------------------------------------

/** "Join doubles" on a player who is open with lookingForDoubles. */
export async function joinDoubles(context: TenantContext, viewerId: string, hostId: string) {
  if (viewerId === hostId) {
    throw new CommunityError("CANNOT_TARGET_SELF", "You can't join your own doubles.", 400)
  }
  await requireCardHolder(viewerId)
  await requireVisiblePlayer(context, viewerId, hostId)

  const now = new Date()
  const [availability] = await db
    .select()
    .from(playAvailability)
    .where(
      and(
        eq(playAvailability.userId, hostId),
        isNull(playAvailability.endedAt),
        gt(playAvailability.endsAt, now),
        eq(playAvailability.lookingForDoubles, true),
      ),
    )
    .limit(1)

  if (!availability) {
    throw new CommunityError("BOOKING_NOT_JOINABLE", "They're not looking for doubles right now.", 409)
  }

  const hostName = await nameOf(hostId)
  await db
    .insert(communityConversations)
    .values({
      tenantId: context.tenantId,
      type: "group",
      title: `2v2 with ${hostName}`,
      availabilityId: availability.id,
      locationId: availability.locationId,
      maxMembers: GROUP_LIMITS.doublesMaxMembers,
      createdBy: hostId,
      startsAt: availability.startsAt,
    })
    .onConflictDoNothing()

  const [group] = await db
    .select()
    .from(communityConversations)
    .where(eq(communityConversations.availabilityId, availability.id))
    .limit(1)
  if (!group) throw new Error("Could not create the doubles group.")

  // The host is the group's admin.
  await db
    .insert(communityConversationMembers)
    .values({
      conversationId: group.id,
      tenantId: context.tenantId,
      userId: hostId,
      role: "admin",
      state: "active",
      acceptedAt: now,
    })
    .onConflictDoNothing()

  const messageId = await addMember(context, group.id, viewerId, group.maxMembers ?? GROUP_LIMITS.doublesMaxMembers, false)
  if (messageId) {
    deliverCommunityNotificationSoon(context.tenantId, {
      kind: "message",
      conversationId: group.id,
      messageId,
      senderId: viewerId,
    })
  }

  return { group: await summarizeGroup(context, viewerId, await requireGroup(context, viewerId, group.id)) }
}

// --- Events ---------------------------------------------------------------

export async function listEvents(context: TenantContext, viewerId: string) {
  const now = new Date()
  const venue = await requireHomeVenue(context, viewerId)
  const since = new Date(now.getTime() - 3 * 60 * 60_000)

  const rows = await db
    .select({
      conversation: communityConversations,
      members: sql<number>`(select count(*)::int from ${communityConversationMembers} m
        where m.conversation_id = ${communityConversations.id} and m.state = 'active')`,
      joined: sql<boolean>`exists (select 1 from ${communityConversationMembers} m
        where m.conversation_id = ${communityConversations.id} and m.user_id = ${viewerId} and m.state = 'active')`,
    })
    .from(communityConversations)
    .where(
      and(
        eq(communityConversations.tenantId, context.tenantId),
        eq(communityConversations.type, "event"),
        isNull(communityConversations.closedAt),
        or(eq(communityConversations.locationId, venue.id), isNull(communityConversations.locationId)),
        gt(communityConversations.startsAt, since),
      ),
    )
    .orderBy(asc(communityConversations.startsAt))
    .limit(10)

  return {
    events: rows.map((row) => ({
      id: row.conversation.id,
      title: row.conversation.title ?? "Event",
      description: row.conversation.description,
      startsAt: row.conversation.startsAt?.toISOString() ?? null,
      maxMembers: row.conversation.maxMembers,
      memberCount: row.members,
      joined: Boolean(row.joined),
    })),
  }
}

export async function joinEvent(context: TenantContext, viewerId: string, eventId: string) {
  if (!UUID_PATTERN.test(eventId)) groupNotFound()
  await requireCardHolder(viewerId)

  const [event] = await db
    .select()
    .from(communityConversations)
    .where(
      and(
        eq(communityConversations.id, eventId),
        eq(communityConversations.tenantId, context.tenantId),
        eq(communityConversations.type, "event"),
      ),
    )
    .limit(1)
  if (!event) groupNotFound()

  const messageId = await addMember(
    context,
    event.id,
    viewerId,
    event.maxMembers ?? GROUP_LIMITS.eventMaxMembersCap,
    Boolean(event.closedAt),
  )
  if (messageId) {
    deliverCommunityNotificationSoon(context.tenantId, {
      kind: "message",
      conversationId: event.id,
      messageId,
      senderId: viewerId,
    })
  }
  return { group: await summarizeGroup(context, viewerId, await requireGroup(context, viewerId, event.id)) }
}

/** Ops creates an event from the admin console. */
export async function createEvent(
  context: TenantContext,
  adminId: string,
  input: { title: string; description?: string | null; startsAt: Date; maxMembers: number; locationId?: string | null },
) {
  const [row] = await db
    .insert(communityConversations)
    .values({
      tenantId: context.tenantId,
      type: "event",
      title: input.title,
      description: input.description ?? null,
      startsAt: input.startsAt,
      maxMembers: Math.min(input.maxMembers, GROUP_LIMITS.eventMaxMembersCap),
      locationId: input.locationId ?? null,
      createdBy: adminId,
    })
    .returning({ id: communityConversations.id })
  return { id: row.id }
}

export async function listEventsForAdmin(context: TenantContext) {
  const rows = await db
    .select({
      conversation: communityConversations,
      members: sql<number>`(select count(*)::int from ${communityConversationMembers} m
        where m.conversation_id = ${communityConversations.id} and m.state = 'active')`,
    })
    .from(communityConversations)
    .where(and(eq(communityConversations.tenantId, context.tenantId), eq(communityConversations.type, "event")))
    .orderBy(desc(communityConversations.startsAt))
    .limit(50)

  return rows.map((row) => ({
    id: row.conversation.id,
    title: row.conversation.title ?? "Event",
    startsAt: row.conversation.startsAt?.toISOString() ?? null,
    maxMembers: row.conversation.maxMembers,
    memberCount: row.members,
    closed: Boolean(row.conversation.closedAt),
  }))
}

export async function closeEvent(context: TenantContext, eventId: string) {
  await db
    .update(communityConversations)
    .set({ closedAt: new Date() })
    .where(
      and(
        eq(communityConversations.id, eventId),
        eq(communityConversations.tenantId, context.tenantId),
        eq(communityConversations.type, "event"),
      ),
    )
  return { ok: true }
}

// --- Group chat -----------------------------------------------------------

export async function listGroups(context: TenantContext, viewerId: string) {
  const rows = await db
    .select({ conversation: communityConversations, me: communityConversationMembers })
    .from(communityConversationMembers)
    .innerJoin(communityConversations, eq(communityConversations.id, communityConversationMembers.conversationId))
    .where(
      and(
        eq(communityConversationMembers.userId, viewerId),
        eq(communityConversationMembers.state, "active"),
        eq(communityConversations.tenantId, context.tenantId),
        ne(communityConversations.type, "direct"),
      ),
    )
    .orderBy(
      sql`${communityConversations.lastMessageAt} desc nulls last`,
      desc(communityConversations.createdAt),
    )
    .limit(CHAT_LIMITS.conversationsPageSize)

  return { groups: await Promise.all(rows.map((row) => summarizeGroup(context, viewerId, row))) }
}

export async function listGroupMessages(
  context: TenantContext,
  viewerId: string,
  conversationId: string,
  input: { before?: number; after?: number },
) {
  const frame = await requireGroup(context, viewerId, conversationId)
  const pageSize = CHAT_LIMITS.messagesPageSize
  const base = eq(communityMessages.conversationId, conversationId)
  const blocked = await blockedByMe(viewerId)

  let rows: (typeof communityMessages.$inferSelect)[]
  let hasMore = false
  if (input.after !== undefined) {
    rows = await db
      .select()
      .from(communityMessages)
      .where(and(base, gt(communityMessages.seq, input.after)))
      .orderBy(asc(communityMessages.seq))
      .limit(pageSize)
    hasMore = rows.length === pageSize
  } else {
    const newestFirst = await db
      .select()
      .from(communityMessages)
      .where(input.before !== undefined ? and(base, lt(communityMessages.seq, input.before)) : base)
      .orderBy(desc(communityMessages.seq))
      .limit(pageSize + 1)
    hasMore = newestFirst.length > pageSize
    rows = newestFirst.slice(0, pageSize).reverse()
  }

  // Sender names travel with group messages (direct chats show them in the header).
  const senderIds = [...new Set(rows.map((row) => row.senderId).filter((id): id is string => Boolean(id)))]
  const names = senderIds.length
    ? new Map(
        (await db.select({ id: user.id, name: user.name }).from(user).where(inArray(user.id, senderIds))).map((row) => [
          row.id,
          toCommunityDisplayName(row.name),
        ]),
      )
    : new Map<string, string>()

  return {
    messages: rows
      .filter((row) => !(row.senderId && blocked.has(row.senderId)))
      .map((row) => ({ ...serializeMessage(row, viewerId), senderName: row.senderId ? (names.get(row.senderId) ?? null) : null })),
    hasMore,
    group: input.after === undefined ? await summarizeGroup(context, viewerId, frame) : null,
  }
}

export async function sendGroupMessage(
  context: TenantContext,
  viewerId: string,
  conversationId: string,
  input: CommunityMessageInput,
) {
  const frame = await requireGroup(context, viewerId, conversationId)
  if (frame.conversation.closedAt) {
    throw new CommunityError("CANNOT_MESSAGE", "This group is closed.", 403)
  }

  const duplicate = await findByClientId(conversationId, viewerId, input.clientMessageId)
  if (duplicate) return { message: serializeMessage(duplicate, viewerId), duplicate: true }

  assertNotMuted(await getProfileRow(viewerId))
  assertRateLimit("message", viewerId)
  if (input.kind === "booking_card") {
    throw new CommunityError("MESSAGE_REJECTED", "Share bookings in a direct chat.", 422)
  }
  const content = await buildContent(context, viewerId, input, new Date())

  const message = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(communityMessages)
      .values({
        tenantId: context.tenantId,
        conversationId,
        senderId: viewerId,
        kind: content.kind,
        body: content.body,
        payload: content.payload,
        clientMessageId: input.clientMessageId,
      })
      .onConflictDoNothing()
      .returning()
    if (!row) return null

    await tx
      .update(communityConversations)
      .set({ lastMessageAt: row.createdAt })
      .where(eq(communityConversations.id, conversationId))
    await tx
      .update(communityConversationMembers)
      .set({ lastReadSeq: row.seq })
      .where(
        and(
          eq(communityConversationMembers.conversationId, conversationId),
          eq(communityConversationMembers.userId, viewerId),
        ),
      )
    await enqueueCommunityNotification(
      context.tenantId,
      { kind: "message", conversationId, messageId: row.id, senderId: viewerId },
      tx,
    )
    return row
  })

  if (!message) {
    const winner = await findByClientId(conversationId, viewerId, input.clientMessageId)
    if (!winner) throw new Error("Message insert conflicted without a matching row.")
    return { message: serializeMessage(winner, viewerId), duplicate: true }
  }

  deliverCommunityNotificationSoon(context.tenantId, {
    kind: "message",
    conversationId,
    messageId: message.id,
    senderId: viewerId,
  })
  return { message: serializeMessage(message, viewerId), duplicate: false }
}

export async function markGroupRead(context: TenantContext, viewerId: string, conversationId: string, seq: number) {
  await requireGroup(context, viewerId, conversationId)
  await db
    .update(communityConversationMembers)
    .set({
      lastReadSeq: sql`greatest(${communityConversationMembers.lastReadSeq}, least(${seq}::bigint, coalesce((
        select max(${communityMessages.seq}) from ${communityMessages}
        where ${communityMessages.conversationId} = ${conversationId}
      ), 0)))`,
    })
    .where(
      and(
        eq(communityConversationMembers.conversationId, conversationId),
        eq(communityConversationMembers.userId, viewerId),
      ),
    )
  return { read: true }
}

export async function muteGroup(context: TenantContext, viewerId: string, conversationId: string, hours: number | null) {
  await requireGroup(context, viewerId, conversationId)
  const mutedUntil = hours ? new Date(Date.now() + hours * 60 * 60_000) : null
  await db
    .update(communityConversationMembers)
    .set({ mutedUntil })
    .where(
      and(
        eq(communityConversationMembers.conversationId, conversationId),
        eq(communityConversationMembers.userId, viewerId),
      ),
    )
  return { mutedUntil: mutedUntil?.toISOString() ?? null }
}

async function setMemberLeft(
  context: TenantContext,
  conversationId: string,
  userId: string,
  body: string,
) {
  // No push for leaving; members see it next time they open the group.
  return db.transaction(async (tx) => {
    await tx
      .update(communityConversationMembers)
      .set({ state: "left", role: "member" })
      .where(
        and(
          eq(communityConversationMembers.conversationId, conversationId),
          eq(communityConversationMembers.userId, userId),
        ),
      )
    const message = await insertServerMessage(tx, {
      tenantId: context.tenantId,
      conversationId,
      kind: "system",
      body,
      payload: { event: "left", userId },
    })
    return message.id
  })
}

export async function leaveGroup(context: TenantContext, viewerId: string, conversationId: string) {
  await requireGroup(context, viewerId, conversationId)
  await setMemberLeft(context, conversationId, viewerId, `${await nameOf(viewerId)} left`)
  return { left: true }
}

/** Group admins (the doubles host) can remove members. */
export async function removeGroupMember(
  context: TenantContext,
  viewerId: string,
  conversationId: string,
  memberId: string,
) {
  const frame = await requireGroup(context, viewerId, conversationId)
  if (frame.me.role !== "admin") {
    throw new CommunityError("CANNOT_MESSAGE", "Only the group admin can remove people.", 403)
  }
  if (memberId === viewerId) {
    throw new CommunityError("CANNOT_TARGET_SELF", "Leave the group instead.", 400)
  }
  await setMemberLeft(context, conversationId, memberId, `${await nameOf(memberId)} was removed`)
  return { removed: true }
}
