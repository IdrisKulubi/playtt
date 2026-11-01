// Community push notifications (docs/community/README.md, M3).
//
// Each event is written to the outbox in the same transaction as the change
// that caused it, then delivered straight away with Next's `after()`. The
// durable worker (cron, every minute) is the fallback; the notifications
// table's deduplication key stops the same push going out twice.

import { and, eq, gt, inArray, ne, or, sql } from "drizzle-orm"
import { after } from "next/server"

import db from "@/db/drizzle"
import {
  bookings,
  communityBookingPartners,
  communityConversationMembers,
  communityConversations,
  communityMessages,
  follows,
  playAvailability,
  playerProfiles,
  user,
  userBlocks,
} from "@/db/schema"
import { queueAndDeliverPushNotification } from "@/server/notifications/push-delivery"
import { EVENT_TYPES, EVENT_VERSION } from "@/server/workers/events.mjs"
import { enqueueOutboxEvent } from "@/server/workers/outbox-repository"

import {
  followeeOpenDeduplicationKey,
  messagePushDeduplicationKey,
  pushPreview,
} from "./chat-rules.ts"
import { applyMatchRating } from "./rating-store.ts"
import { findDirectConversationId, hasKudosPrompt, insertServerMessage } from "./chat-messages.ts"
import { KUDOS_LABELS, type KudosType } from "./constants.ts"
import { toCommunityDisplayName } from "./display-name.ts"

export type CommunityNotificationEvent =
  | { kind: "message"; conversationId: string; messageId: string; senderId: string }
  | { kind: "follow"; followerId: string; followeeId: string }
  | { kind: "followee_open"; userId: string; availabilityId: string }
  | { kind: "kudos"; bookingId: string; giverId: string; receiverId: string; types: KudosType[] }
  | { kind: "post_match"; bookingId: string }
  // Not a push: updates ratings when a scoreboard match completes (M5).
  | { kind: "match_completed"; matchId: string }

type Executor = Parameters<typeof enqueueOutboxEvent>[1]

function eventIdentity(event: CommunityNotificationEvent) {
  switch (event.kind) {
    case "message":
      return { aggregateType: "community_message", aggregateId: event.messageId, key: event.messageId }
    case "follow":
      return {
        aggregateType: "community_follow",
        aggregateId: event.followeeId,
        key: `${event.followerId}:${event.followeeId}`,
      }
    case "followee_open":
      return { aggregateType: "play_availability", aggregateId: event.availabilityId, key: event.availabilityId }
    case "kudos":
      return {
        aggregateType: "community_kudos",
        aggregateId: event.bookingId,
        key: `${event.bookingId}:${event.giverId}:${event.receiverId}:${[...event.types].sort().join(",")}`,
      }
    case "post_match":
      return { aggregateType: "booking", aggregateId: event.bookingId, key: event.bookingId }
    case "match_completed":
      // Keyed per attempt so re-assigning sides after completion can enqueue
      // again; the rated-matches ledger keeps rating idempotent.
      return { aggregateType: "match", aggregateId: event.matchId, key: `${event.matchId}:${Date.now()}` }
  }
}

export async function enqueueCommunityNotification(
  tenantId: string,
  event: CommunityNotificationEvent,
  tx?: Executor,
) {
  const identity = eventIdentity(event)
  return enqueueOutboxEvent(
    {
      tenantId,
      aggregateType: identity.aggregateType,
      aggregateId: identity.aggregateId,
      eventType: EVENT_TYPES.COMMUNITY_NOTIFICATION_REQUESTED_V1,
      eventVersion: EVENT_VERSION,
      correlationId: `community:${event.kind}:${identity.key}`,
      payload: event,
      idempotencyKey: `${EVENT_TYPES.COMMUNITY_NOTIFICATION_REQUESTED_V1}:${event.kind}:${identity.key}`,
    },
    tx,
  )
}

/** Delivers after the response is sent; the outbox retries if this fails. */
export function deliverCommunityNotificationSoon(tenantId: string, event: CommunityNotificationEvent) {
  const run = () =>
    deliverCommunityNotification(tenantId, event).catch((error) => {
      console.error("[community] Immediate push failed; the outbox will retry", error)
    })

  try {
    after(run)
  } catch {
    // Outside a request (scripts, tests): leave it to the durable worker.
  }
}

async function displayNameOf(userId: string) {
  const [row] = await db.select({ name: user.name }).from(user).where(eq(user.id, userId)).limit(1)
  return toCommunityDisplayName(row?.name)
}

async function isBlockedEitherWay(a: string, b: string) {
  const [row] = await db
    .select({ id: userBlocks.id })
    .from(userBlocks)
    .where(
      or(
        and(eq(userBlocks.blockerId, a), eq(userBlocks.blockedId, b)),
        and(eq(userBlocks.blockerId, b), eq(userBlocks.blockedId, a)),
      ),
    )
    .limit(1)
  return Boolean(row)
}

async function deliverMessage(tenantId: string, event: Extract<CommunityNotificationEvent, { kind: "message" }>) {
  const [message] = await db
    .select({
      seq: communityMessages.seq,
      kind: communityMessages.kind,
      body: communityMessages.body,
      createdAt: communityMessages.createdAt,
      deletedAt: communityMessages.deletedAt,
    })
    .from(communityMessages)
    .where(and(eq(communityMessages.id, event.messageId), eq(communityMessages.tenantId, tenantId)))
    .limit(1)

  if (!message || message.deletedAt) return { skipped: true }

  const now = new Date()
  const recipients = await db
    .select({
      userId: communityConversationMembers.userId,
      state: communityConversationMembers.state,
    })
    .from(communityConversationMembers)
    .where(
      and(
        eq(communityConversationMembers.conversationId, event.conversationId),
        ne(communityConversationMembers.userId, event.senderId),
        ne(communityConversationMembers.state, "left"),
        // Already read (e.g. the chat is open and polling): no push.
        sql`${communityConversationMembers.lastReadSeq} < ${message.seq}`,
        or(
          sql`${communityConversationMembers.mutedUntil} is null`,
          sql`${communityConversationMembers.mutedUntil} <= ${now}`,
        ),
      ),
    )

  if (recipients.length === 0) return { skipped: true }

  const senderName = await displayNameOf(event.senderId)
  const preview = message.kind === "booking_card" ? "Shared a booking 🏓" : pushPreview(message.body)
  const [conversation] = await db
    .select({ type: communityConversations.type, title: communityConversations.title })
    .from(communityConversations)
    .where(eq(communityConversations.id, event.conversationId))
    .limit(1)
  // Group pushes say which group: "Amara K. · 2v2 with Idris K."
  const title = conversation && conversation.type !== "direct" && conversation.title
    ? `${senderName} · ${conversation.title}`
    : senderName

  for (const recipient of recipients) {
    if (await isBlockedEitherWay(event.senderId, recipient.userId)) continue

    const isRequest = recipient.state === "request"
    await queueAndDeliverPushNotification({
      tenantId,
      userId: recipient.userId,
      templateKey: isRequest ? "community_message_request" : "community_message",
      // Requests make one quiet push per conversation; chats collapse per minute.
      deduplicationKey: isRequest
        ? `community-request:${event.conversationId}:${recipient.userId}`
        : messagePushDeduplicationKey(event.conversationId, recipient.userId, message.createdAt),
      payload: { conversationId: event.conversationId, messageId: event.messageId },
      copy: isRequest
        ? { title: "New message request", body: `${senderName} wants to play.` }
        : { title, body: preview },
      data: { conversationId: event.conversationId },
    })
  }

  return { delivered: true }
}

async function deliverFollow(tenantId: string, event: Extract<CommunityNotificationEvent, { kind: "follow" }>) {
  const [stillFollowing] = await db
    .select({ id: follows.id })
    .from(follows)
    .innerJoin(playerProfiles, eq(playerProfiles.userId, follows.followerId))
    .where(
      and(
        eq(follows.followerId, event.followerId),
        eq(follows.followeeId, event.followeeId),
        eq(playerProfiles.communityVisible, true),
      ),
    )
    .limit(1)

  if (!stillFollowing || (await isBlockedEitherWay(event.followerId, event.followeeId))) {
    return { skipped: true }
  }

  const name = await displayNameOf(event.followerId)
  return queueAndDeliverPushNotification({
    tenantId,
    userId: event.followeeId,
    templateKey: "community_follow",
    deduplicationKey: `community-follow:${event.followerId}:${event.followeeId}`,
    payload: { playerId: event.followerId },
    copy: { title: "New follower", body: `${name} started following you` },
    data: { playerId: event.followerId },
  })
}

const OPEN_WINDOW_COPY = {
  now: "now",
  today: "today",
  tonight: "tonight",
  weekend: "this weekend",
} as const

async function deliverFolloweeOpen(
  tenantId: string,
  event: Extract<CommunityNotificationEvent, { kind: "followee_open" }>,
) {
  const now = new Date()
  const [availability] = await db
    .select({ window: playAvailability.window })
    .from(playAvailability)
    .where(
      and(
        eq(playAvailability.id, event.availabilityId),
        sql`${playAvailability.endedAt} is null`,
        gt(playAvailability.endsAt, now),
      ),
    )
    .limit(1)

  if (!availability) return { skipped: true }

  const followerRows = await db
    .select({ followerId: follows.followerId })
    .from(follows)
    .innerJoin(playerProfiles, eq(playerProfiles.userId, follows.followerId))
    .where(
      and(
        eq(follows.followeeId, event.userId),
        eq(playerProfiles.tenantId, tenantId),
        eq(playerProfiles.communityVisible, true),
      ),
    )

  const followerIds = followerRows.map((row) => row.followerId)
  if (followerIds.length === 0) return { skipped: true }

  const blocked = await db
    .select({ blockerId: userBlocks.blockerId, blockedId: userBlocks.blockedId })
    .from(userBlocks)
    .where(
      or(
        and(eq(userBlocks.blockerId, event.userId), inArray(userBlocks.blockedId, followerIds)),
        and(eq(userBlocks.blockedId, event.userId), inArray(userBlocks.blockerId, followerIds)),
      ),
    )
  const excluded = new Set(blocked.flatMap((row) => [row.blockerId, row.blockedId]))

  const name = await displayNameOf(event.userId)
  const body = `${name} is open to play ${OPEN_WINDOW_COPY[availability.window]}`

  for (const followerId of followerIds) {
    if (excluded.has(followerId)) continue
    await queueAndDeliverPushNotification({
      tenantId,
      userId: followerId,
      templateKey: "community_followee_open",
      deduplicationKey: followeeOpenDeduplicationKey(followerId, now),
      payload: { playerId: event.userId, availabilityId: event.availabilityId },
      copy: { title: "Open to play", body },
      data: { playerId: event.userId },
    })
  }

  return { delivered: true }
}

async function deliverKudos(tenantId: string, event: Extract<CommunityNotificationEvent, { kind: "kudos" }>) {
  if (await isBlockedEitherWay(event.giverId, event.receiverId)) return { skipped: true }

  const name = await displayNameOf(event.giverId)
  const labels = event.types.map((type) => KUDOS_LABELS[type])
  const list = labels.length > 1 ? `${labels.slice(0, -1).join(", ")} and ${labels.at(-1)}` : labels[0]
  const conversationId = await findDirectConversationId(tenantId, event.giverId, event.receiverId)

  return queueAndDeliverPushNotification({
    tenantId,
    userId: event.receiverId,
    templateKey: "community_kudos",
    deduplicationKey: `community-kudos:${event.bookingId}:${event.giverId}:${event.receiverId}`,
    payload: { bookingId: event.bookingId, giverId: event.giverId, types: event.types },
    copy: { title: "You got kudos 🏓", body: `${name} gave you ${list}` },
    data: conversationId ? { conversationId } : { playerId: event.giverId },
  })
}

/**
 * After a shared booking's session completes: a kudos prompt in each pair's
 * chat and one "How was your match?" push per player.
 */
async function deliverPostMatch(tenantId: string, event: Extract<CommunityNotificationEvent, { kind: "post_match" }>) {
  const partners = await db
    .select({ userId: communityBookingPartners.userId, name: user.name })
    .from(communityBookingPartners)
    .innerJoin(bookings, eq(bookings.id, communityBookingPartners.bookingId))
    .innerJoin(user, eq(user.id, communityBookingPartners.userId))
    .where(
      and(
        eq(communityBookingPartners.tenantId, tenantId),
        eq(communityBookingPartners.bookingId, event.bookingId),
        sql`${communityBookingPartners.leftAt} is null`,
        ne(bookings.status, "cancelled"),
      ),
    )

  if (partners.length < 2) return { skipped: true }

  for (const player of partners) {
    const others = partners.filter((other) => other.userId !== player.userId)
    let conversationId: string | null = null

    for (const other of others) {
      const id = await findDirectConversationId(tenantId, player.userId, other.userId)
      if (!id) continue
      conversationId ??= id
      // One prompt per chat; the second player's loop finds it already there.
      if (!(await hasKudosPrompt(id, event.bookingId))) {
        await insertServerMessage(db, {
          tenantId,
          conversationId: id,
          kind: "kudos_prompt",
          body: "How was your match? Give kudos or play again.",
          payload: { bookingId: event.bookingId },
        })
      }
    }

    const otherName =
      others.length === 1 ? toCommunityDisplayName(others[0].name) : "your partners"
    await queueAndDeliverPushNotification({
      tenantId,
      userId: player.userId,
      bookingId: event.bookingId,
      templateKey: "community_play_again",
      deduplicationKey: `community-play-again:${event.bookingId}:${player.userId}`,
      payload: { bookingId: event.bookingId },
      copy: { title: `How was your match with ${otherName}?`, body: "Give kudos · Play again" },
      data: conversationId ? { conversationId } : {},
    })
  }

  return { delivered: true }
}

export async function deliverCommunityNotification(tenantId: string, event: CommunityNotificationEvent) {
  switch (event.kind) {
    case "message":
      return deliverMessage(tenantId, event)
    case "follow":
      return deliverFollow(tenantId, event)
    case "followee_open":
      return deliverFolloweeOpen(tenantId, event)
    case "kudos":
      return deliverKudos(tenantId, event)
    case "post_match":
      return deliverPostMatch(tenantId, event)
    case "match_completed":
      return applyMatchRating(tenantId, event.matchId)
  }
}

export function createCommunityNotificationConsumers() {
  return {
    [EVENT_TYPES.COMMUNITY_NOTIFICATION_REQUESTED_V1]: {
      eventVersion: EVENT_VERSION,
      consume: async (row: { tenantId: string | null; payload: Record<string, unknown> }) => {
        if (!row.tenantId) {
          throw new Error("community.notification.requested.v1 event is missing a tenant.")
        }
        return deliverCommunityNotification(row.tenantId, row.payload as CommunityNotificationEvent)
      },
    },
  }
}
