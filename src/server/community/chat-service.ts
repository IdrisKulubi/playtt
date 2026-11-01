// Community chat (docs/community/README.md, M3): direct conversations,
// message requests, booking cards, read markers and unread counts.

import { and, asc, desc, eq, gt, inArray, isNotNull, lt, ne, or, sql } from "drizzle-orm"
import { alias } from "drizzle-orm/pg-core"

import db from "@/db/drizzle"
import {
  bookings,
  communityConversationMembers,
  communityConversations,
  communityMessages,
  locations,
  playAvailability,
  playerProfiles,
  resources,
  user,
} from "@/db/schema"
import type { TenantContext } from "@/server/tenancy/types"

import { decideSend, directConversationKey, initialRecipientState, type MemberState } from "./chat-rules.ts"
import { EMPTY_CARD_STATS } from "./card-stats.ts"
import { CHAT_LIMITS, QUICK_REPLIES, type ConversationFolder } from "./constants.ts"
import { CommunityError } from "./errors.ts"
import type { CommunityMessageInput, CommunityStartConversationInput } from "./http.ts"
import { filterMessageBody } from "./message-filter.ts"
import { deliverCommunityNotificationSoon, enqueueCommunityNotification } from "./notify.ts"
import {
  activeAvailabilityJoin,
  assertNotSelf,
  assertRateLimit,
  decodeCursor,
  encodeCursor,
  factsFor,
  getProfileRow,
  loadRelationships,
  requireVisiblePlayer,
  serializePlayer,
  type PlayerRow,
} from "./service.ts"
import { canMessage, canSee, type RelationshipFacts } from "./visibility.ts"

type MessageRow = typeof communityMessages.$inferSelect
type MemberRow = typeof communityConversationMembers.$inferSelect

const otherMember = alias(communityConversationMembers, "other_member")

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function notFound(): never {
  throw new CommunityError("CONVERSATION_NOT_FOUND", "We could not find that conversation.", 404)
}

// Neutral on purpose: blocked, hidden and policy failures look the same.
function cannotMessage(): never {
  throw new CommunityError("CANNOT_MESSAGE", "This player isn't accepting messages right now.", 403)
}

function serializeMessage(row: MessageRow, viewerId: string) {
  const deleted = Boolean(row.deletedAt)
  return {
    id: row.id,
    seq: row.seq,
    conversationId: row.conversationId,
    senderId: row.senderId,
    mine: row.senderId === viewerId,
    kind: row.kind,
    body: deleted ? "Message deleted" : row.body,
    payload: deleted ? null : (row.payload ?? null),
    clientMessageId: row.senderId === viewerId ? row.clientMessageId : null,
    createdAt: row.createdAt.toISOString(),
  }
}

async function loadPlayerRows(context: TenantContext, ids: string[], now: Date) {
  if (ids.length === 0) return new Map<string, PlayerRow>()

  const rows = await db
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
    .where(inArray(user.id, ids))

  return new Map(rows.map((row) => [row.id, row]))
}

type ConversationFrame = {
  conversationId: string
  type: "direct" | "group" | "event"
  me: MemberRow
  other: MemberRow
  peer: PlayerRow
  facts: RelationshipFacts
}

// Loads the viewer's membership plus the other side of a direct chat, or 404s
// when the viewer is not a member, left it, or the peer is hidden or blocked.
async function requireConversation(
  context: TenantContext,
  viewerId: string,
  conversationId: string,
  now: Date,
  options: { allowLeft?: boolean } = {},
): Promise<ConversationFrame> {
  if (!UUID_PATTERN.test(conversationId)) notFound()

  const [row] = await db
    .select({
      conversation: communityConversations,
      me: communityConversationMembers,
      other: otherMember,
    })
    .from(communityConversationMembers)
    .innerJoin(
      communityConversations,
      eq(communityConversations.id, communityConversationMembers.conversationId),
    )
    .innerJoin(
      otherMember,
      and(
        eq(otherMember.conversationId, communityConversations.id),
        ne(otherMember.userId, viewerId),
      ),
    )
    .where(
      and(
        eq(communityConversationMembers.conversationId, conversationId),
        eq(communityConversationMembers.userId, viewerId),
        eq(communityConversations.tenantId, context.tenantId),
        eq(communityConversations.type, "direct"),
      ),
    )
    .limit(1)

  if (!row || (row.me.state === "left" && !options.allowLeft)) notFound()

  const players = await loadPlayerRows(context, [row.other.userId], now)
  const peer = players.get(row.other.userId)
  const maps = await loadRelationships(viewerId, [row.other.userId])
  const facts = peer ? factsFor(viewerId, peer, maps) : null

  if (!peer || !facts || !canSee(facts)) notFound()

  return {
    conversationId: row.conversation.id,
    type: row.conversation.type,
    me: row.me,
    other: row.other,
    peer,
    facts,
  }
}

function pendingRequest(frame: Pick<ConversationFrame, "other">, sentWhilePending: number) {
  if (frame.other.acceptedAt) return null
  return {
    remaining: Math.max(CHAT_LIMITS.requestMessageLimit - sentWhilePending, 0),
  }
}

async function countMyMessages(conversationId: string, viewerId: string) {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(communityMessages)
    .where(and(eq(communityMessages.conversationId, conversationId), eq(communityMessages.senderId, viewerId)))
  return row?.count ?? 0
}

function canSendIn(frame: ConversationFrame) {
  if (frame.facts.viewerBlockedTarget || frame.facts.targetBlockedViewer) return false
  // Once the other player has the chat in their inbox, their request policy no
  // longer applies; before that it decides whether we may reach them at all.
  return Boolean(frame.other.acceptedAt) || canMessage(frame.facts)
}

async function summarize(context: TenantContext, viewerId: string, frame: ConversationFrame) {
  const [[last], [unread], mine] = await Promise.all([
    db
      .select()
      .from(communityMessages)
      .where(eq(communityMessages.conversationId, frame.conversationId))
      .orderBy(desc(communityMessages.seq))
      .limit(1),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(communityMessages)
      .where(
        and(
          eq(communityMessages.conversationId, frame.conversationId),
          gt(communityMessages.seq, frame.me.lastReadSeq),
          sql`${communityMessages.senderId} is distinct from ${viewerId}`,
        ),
      ),
    frame.other.acceptedAt ? Promise.resolve(0) : countMyMessages(frame.conversationId, viewerId),
  ])

  return {
    id: frame.conversationId,
    type: frame.type,
    state: frame.me.state as MemberState,
    player: serializePlayer(frame.peer, frame.facts, new Date(), EMPTY_CARD_STATS),
    lastMessage: last ? serializeMessage(last, viewerId) : null,
    unreadCount: unread?.count ?? 0,
    otherLastReadSeq: frame.other.lastReadSeq,
    canSend: canSendIn(frame),
    pendingRequest: pendingRequest(frame, mine),
  }
}

// --- Conversations --------------------------------------------------------

export async function listConversations(
  context: TenantContext,
  viewerId: string,
  input: { folder: ConversationFolder; cursor?: string },
) {
  const now = new Date()
  const offset = decodeCursor(input.cursor)
  const pageSize = CHAT_LIMITS.conversationsPageSize
  const state: MemberState = input.folder === "requests" ? "request" : "active"

  // Over-fetch: hidden or blocked peers are filtered out after loading facts.
  const rows = await db
    .select({ me: communityConversationMembers, other: otherMember, type: communityConversations.type })
    .from(communityConversationMembers)
    .innerJoin(
      communityConversations,
      eq(communityConversations.id, communityConversationMembers.conversationId),
    )
    .innerJoin(
      otherMember,
      and(
        eq(otherMember.conversationId, communityConversations.id),
        ne(otherMember.userId, viewerId),
      ),
    )
    .where(
      and(
        eq(communityConversationMembers.userId, viewerId),
        eq(communityConversationMembers.state, state),
        eq(communityConversations.tenantId, context.tenantId),
        eq(communityConversations.type, "direct"),
        // Hide empty chats the other person opened but never wrote in.
        or(
          isNotNull(communityConversations.lastMessageAt),
          eq(communityConversations.createdBy, viewerId),
        ),
      ),
    )
    .orderBy(
      sql`${communityConversations.lastMessageAt} desc nulls last`,
      desc(communityConversations.createdAt),
    )
    .limit(pageSize + 1)
    .offset(offset)

  const page = rows.slice(0, pageSize)
  const peerIds = page.map((row) => row.other.userId)
  const [players, maps] = await Promise.all([
    loadPlayerRows(context, peerIds, now),
    loadRelationships(viewerId, peerIds),
  ])

  const frames: ConversationFrame[] = []
  for (const row of page) {
    const peer = players.get(row.other.userId)
    if (!peer) continue
    const facts = factsFor(viewerId, peer, maps)
    if (!canSee(facts)) continue
    frames.push({ conversationId: row.me.conversationId, type: row.type, me: row.me, other: row.other, peer, facts })
  }

  return {
    conversations: await Promise.all(frames.map((frame) => summarize(context, viewerId, frame))),
    nextCursor: rows.length > pageSize ? encodeCursor(offset + pageSize) : null,
  }
}

export async function startDirectConversation(
  context: TenantContext,
  viewerId: string,
  input: CommunityStartConversationInput,
) {
  assertNotSelf(viewerId, input.userId)

  const myProfile = await getProfileRow(viewerId)
  if (!myProfile?.communityVisible) {
    throw new CommunityError(
      "COMMUNITY_PROFILE_REQUIRED",
      "Create your community card before messaging players.",
      409,
    )
  }

  const { facts } = await requireVisiblePlayer(context, viewerId, input.userId)
  const directKey = directConversationKey(viewerId, input.userId)
  const now = new Date()

  const [existing] = await db
    .select({ id: communityConversations.id })
    .from(communityConversations)
    .where(
      and(eq(communityConversations.tenantId, context.tenantId), eq(communityConversations.directKey, directKey)),
    )
    .limit(1)

  let conversationId = existing?.id

  if (conversationId) {
    // Re-opening a chat you deleted brings it back to your inbox.
    await db
      .update(communityConversationMembers)
      .set({ state: "active", acceptedAt: sql`coalesce(${communityConversationMembers.acceptedAt}, ${now})` })
      .where(
        and(
          eq(communityConversationMembers.conversationId, conversationId),
          eq(communityConversationMembers.userId, viewerId),
          eq(communityConversationMembers.state, "left"),
        ),
      )
  } else {
    if (!canMessage(facts)) cannotMessage()
    assertRateLimit("conversation", viewerId)

    conversationId = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(communityConversations)
        .values({ tenantId: context.tenantId, type: "direct", directKey, createdBy: viewerId })
        .onConflictDoNothing()
        .returning({ id: communityConversations.id })

      // Lost a race with the other player starting the same chat.
      const id =
        created?.id ??
        (
          await tx
            .select({ id: communityConversations.id })
            .from(communityConversations)
            .where(
              and(
                eq(communityConversations.tenantId, context.tenantId),
                eq(communityConversations.directKey, directKey),
              ),
            )
            .limit(1)
        )[0]?.id

      if (!id) throw new Error("Could not create the conversation.")

      const recipientState = initialRecipientState(facts.targetFollowsViewer)
      await tx
        .insert(communityConversationMembers)
        .values([
          { conversationId: id, tenantId: context.tenantId, userId: viewerId, state: "active", acceptedAt: now },
          {
            conversationId: id,
            tenantId: context.tenantId,
            userId: input.userId,
            state: recipientState,
            acceptedAt: recipientState === "active" ? now : null,
          },
        ])
        .onConflictDoNothing()

      return id
    })
  }

  if (input.message) {
    await sendMessage(context, viewerId, conversationId, input.message)
  }

  const frame = await requireConversation(context, viewerId, conversationId, new Date())
  return { conversation: await summarize(context, viewerId, frame) }
}

// --- Messages -------------------------------------------------------------

export async function listMessages(
  context: TenantContext,
  viewerId: string,
  conversationId: string,
  input: { before?: number; after?: number },
) {
  const frame = await requireConversation(context, viewerId, conversationId, new Date())
  const pageSize = CHAT_LIMITS.messagesPageSize
  const base = eq(communityMessages.conversationId, conversationId)

  let rows: MessageRow[]
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

  return {
    messages: rows.map((row) => serializeMessage(row, viewerId)),
    hasMore,
    otherLastReadSeq: frame.other.lastReadSeq,
    // The header only needs this on the first page, not on every poll.
    conversation: input.after === undefined ? await summarize(context, viewerId, frame) : null,
  }
}

async function bookingCardPayload(context: TenantContext, viewerId: string, bookingId: string, now: Date) {
  const [booking] = await db
    .select({
      id: bookings.id,
      startTime: bookings.startTime,
      endTime: bookings.endTime,
      resourceName: resources.name,
      locationName: locations.name,
    })
    .from(bookings)
    .innerJoin(resources, eq(resources.id, bookings.resourceId))
    .innerJoin(locations, eq(locations.id, bookings.locationId))
    .where(
      and(
        eq(bookings.id, bookingId),
        eq(bookings.tenantId, context.tenantId),
        eq(bookings.userId, viewerId),
        eq(bookings.status, "confirmed"),
        gt(bookings.endTime, now),
      ),
    )
    .limit(1)

  if (!booking) {
    throw new CommunityError(
      "BOOKING_NOT_SHAREABLE",
      "Only your upcoming confirmed bookings can be shared.",
      422,
    )
  }

  return {
    bookingId: booking.id,
    startsAt: booking.startTime.toISOString(),
    endsAt: booking.endTime.toISOString(),
    resourceName: booking.resourceName,
    locationName: booking.locationName,
  }
}

async function buildContent(
  context: TenantContext,
  viewerId: string,
  input: CommunityMessageInput,
  now: Date,
): Promise<{ kind: MessageRow["kind"]; body: string; payload: Record<string, unknown> | null }> {
  if (input.kind === "quick_reply") {
    if (!(QUICK_REPLIES as readonly string[]).includes(input.body ?? "")) {
      throw new CommunityError("MESSAGE_REJECTED", "That quick reply isn't available.", 422)
    }
    return { kind: "quick_reply", body: input.body!, payload: null }
  }

  if (input.kind === "booking_card") {
    const payload = await bookingCardPayload(context, viewerId, input.bookingId!, now)
    return { kind: "booking_card", body: "Shared a booking", payload }
  }

  const filtered = filterMessageBody(input.body ?? "")
  if (!filtered.ok) {
    throw new CommunityError(
      "MESSAGE_REJECTED",
      filtered.reason === "LINK_ONLY" ? "Add a few words with your link." : "Write a message first.",
      422,
    )
  }
  return { kind: "text", body: filtered.body, payload: null }
}

async function findByClientId(conversationId: string, viewerId: string, clientMessageId: string) {
  const [row] = await db
    .select()
    .from(communityMessages)
    .where(
      and(
        eq(communityMessages.conversationId, conversationId),
        eq(communityMessages.senderId, viewerId),
        eq(communityMessages.clientMessageId, clientMessageId),
      ),
    )
    .limit(1)
  return row ?? null
}

export async function sendMessage(
  context: TenantContext,
  viewerId: string,
  conversationId: string,
  input: CommunityMessageInput,
) {
  const now = new Date()
  const frame = await requireConversation(context, viewerId, conversationId, now, { allowLeft: true })

  // Retries of the same send return the original message.
  const duplicate = await findByClientId(conversationId, viewerId, input.clientMessageId)
  if (duplicate) {
    return { message: serializeMessage(duplicate, viewerId), duplicate: true }
  }

  if (!canSendIn(frame)) cannotMessage()
  assertRateLimit("message", viewerId)

  const content = await buildContent(context, viewerId, input, now)
  const sentWhilePending = frame.other.acceptedAt ? 0 : await countMyMessages(conversationId, viewerId)
  const decision = decideSend({
    senderState: frame.me.state as MemberState,
    recipientState: frame.other.state as MemberState,
    recipientAccepted: Boolean(frame.other.acceptedAt),
    senderMessagesWhilePending: sentWhilePending,
  })

  if (!decision.ok) {
    throw new CommunityError(
      "REQUEST_LIMIT_REACHED",
      `You can send ${CHAT_LIMITS.requestMessageLimit} messages until they accept your request.`,
      429,
    )
  }

  const inserted = await db.transaction(async (tx) => {
    const [message] = await tx
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

    if (!message) return null

    await tx
      .update(communityConversations)
      .set({ lastMessageAt: message.createdAt })
      .where(eq(communityConversations.id, conversationId))

    // Sending marks your own side read and active (a reply accepts a request).
    await tx
      .update(communityConversationMembers)
      .set({
        lastReadSeq: message.seq,
        state: "active",
        acceptedAt: sql`coalesce(${communityConversationMembers.acceptedAt}, ${now})`,
      })
      .where(
        and(
          eq(communityConversationMembers.conversationId, conversationId),
          eq(communityConversationMembers.userId, viewerId),
        ),
      )

    if (decision.recipientState !== frame.other.state) {
      await tx
        .update(communityConversationMembers)
        .set({ state: decision.recipientState })
        .where(
          and(
            eq(communityConversationMembers.conversationId, conversationId),
            eq(communityConversationMembers.userId, frame.other.userId),
          ),
        )
    }

    await enqueueCommunityNotification(
      context.tenantId,
      { kind: "message", conversationId, messageId: message.id, senderId: viewerId },
      tx,
    )

    return message
  })

  if (!inserted) {
    // A concurrent retry won the unique index; return that copy.
    const winner = await findByClientId(conversationId, viewerId, input.clientMessageId)
    if (!winner) throw new Error("Message insert conflicted without a matching row.")
    return { message: serializeMessage(winner, viewerId), duplicate: true }
  }

  deliverCommunityNotificationSoon(context.tenantId, {
    kind: "message",
    conversationId,
    messageId: inserted.id,
    senderId: viewerId,
  })

  return { message: serializeMessage(inserted, viewerId), duplicate: false }
}

export async function markConversationRead(
  context: TenantContext,
  viewerId: string,
  conversationId: string,
  seq: number,
) {
  await requireConversation(context, viewerId, conversationId, new Date())

  // Never move the marker backwards or past the newest message.
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

export async function acceptConversation(context: TenantContext, viewerId: string, conversationId: string) {
  const now = new Date()
  const frame = await requireConversation(context, viewerId, conversationId, now)

  if (frame.me.state === "request") {
    await db
      .update(communityConversationMembers)
      .set({ state: "active", acceptedAt: now })
      .where(
        and(
          eq(communityConversationMembers.conversationId, conversationId),
          eq(communityConversationMembers.userId, viewerId),
        ),
      )
  }

  const updated = await requireConversation(context, viewerId, conversationId, now)
  return { conversation: await summarize(context, viewerId, updated) }
}

/** Deletes the chat (or request) from your side only. */
export async function leaveConversation(context: TenantContext, viewerId: string, conversationId: string) {
  await requireConversation(context, viewerId, conversationId, new Date())
  await db
    .update(communityConversationMembers)
    .set({ state: "left" })
    .where(
      and(
        eq(communityConversationMembers.conversationId, conversationId),
        eq(communityConversationMembers.userId, viewerId),
      ),
    )
  return { left: true }
}

export async function getUnreadCounts(context: TenantContext, viewerId: string) {
  // Same visibility rules as the lists: peers must be visible and unblocked.
  const result = await db.execute<{ inbox: number; requests: number }>(sql`
    select
      count(*) filter (
        where me.state = 'active' and exists (
          select 1 from ${communityMessages} m
          where m.conversation_id = me.conversation_id
            and m.seq > me.last_read_seq
            and m.sender_id is distinct from ${viewerId}
        )
      )::int as inbox,
      count(*) filter (where me.state = 'request' and c.last_message_at is not null)::int as requests
    from ${communityConversationMembers} me
    join ${communityConversations} c on c.id = me.conversation_id
    join ${communityConversationMembers} other
      on other.conversation_id = me.conversation_id and other.user_id <> me.user_id
    join ${playerProfiles} p on p.user_id = other.user_id and p.community_visible = true
    where me.user_id = ${viewerId}
      and c.tenant_id = ${context.tenantId}
      and c.type = 'direct'
      and not exists (
        select 1 from user_blocks b
        where (b.blocker_id = me.user_id and b.blocked_id = other.user_id)
           or (b.blocker_id = other.user_id and b.blocked_id = me.user_id)
      )
  `)

  const row = result.rows[0]
  return { inbox: Number(row?.inbox ?? 0), requests: Number(row?.requests ?? 0) }
}
