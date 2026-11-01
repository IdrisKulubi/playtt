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
  communityConversationMembers,
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
import { toCommunityDisplayName } from "./display-name.ts"

export type CommunityNotificationEvent =
  | { kind: "message"; conversationId: string; messageId: string; senderId: string }
  | { kind: "follow"; followerId: string; followeeId: string }
  | { kind: "followee_open"; userId: string; availabilityId: string }

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
        : { title: senderName, body: preview },
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

export async function deliverCommunityNotification(tenantId: string, event: CommunityNotificationEvent) {
  switch (event.kind) {
    case "message":
      return deliverMessage(tenantId, event)
    case "follow":
      return deliverFollow(tenantId, event)
    case "followee_open":
      return deliverFolloweeOpen(tenantId, event)
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
