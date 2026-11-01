// Pure chat rules (docs/community/README.md, M3) so they can be tested without
// a database. The chat service loads the facts and applies these decisions.

import { CHAT_LIMITS } from "./constants.ts"

export type MemberState = "active" | "request" | "left"

/** Sorted pair key: one direct conversation per pair of players. */
export function directConversationKey(userA: string, userB: string) {
  return [userA, userB].sort().join(":")
}

/**
 * A first DM lands in the recipient's Requests folder unless the recipient
 * already follows the sender.
 */
export function initialRecipientState(recipientFollowsSender: boolean): MemberState {
  return recipientFollowsSender ? "active" : "request"
}

export type SendDecision =
  | { ok: true; recipientState: MemberState; acceptRequest: boolean }
  | { ok: false; code: "REQUEST_LIMIT_REACHED" }

/**
 * What happens to the recipient's membership when someone sends a message.
 *
 * - Replying while your own side is a request accepts it.
 * - While the recipient hasn't accepted, the sender may send at most
 *   `requestMessageLimit` messages.
 * - A recipient who deleted the chat after accepting it sees it again; one
 *   who deleted an unaccepted request stays hidden.
 */
export function decideSend(input: {
  senderState: MemberState
  recipientState: MemberState
  recipientAccepted: boolean
  senderMessagesWhilePending: number
}): SendDecision {
  const acceptRequest = input.senderState === "request"

  if (input.recipientState === "active") {
    return { ok: true, recipientState: "active", acceptRequest }
  }

  if (input.recipientState === "left" && input.recipientAccepted) {
    return { ok: true, recipientState: "active", acceptRequest }
  }

  if (input.senderMessagesWhilePending >= CHAT_LIMITS.requestMessageLimit) {
    return { ok: false, code: "REQUEST_LIMIT_REACHED" }
  }

  return { ok: true, recipientState: input.recipientState, acceptRequest }
}

/** Collapses a burst of messages into one push per conversation per window. */
export function messagePushDeduplicationKey(conversationId: string, recipientId: string, sentAt: Date) {
  const bucket = Math.floor(sentAt.getTime() / CHAT_LIMITS.messagePushWindowMs)
  return `community-message:${conversationId}:${recipientId}:${bucket}`
}

/** At most one "someone you follow is open" push per recipient per window. */
export function followeeOpenDeduplicationKey(recipientId: string, at: Date) {
  const bucket = Math.floor(at.getTime() / CHAT_LIMITS.followeeOpenPushWindowMs)
  return `community-followee-open:${recipientId}:${bucket}`
}

export function pushPreview(body: string) {
  const flat = body.replace(/\s+/g, " ").trim()
  return flat.length > CHAT_LIMITS.pushPreviewLength
    ? `${flat.slice(0, CHAT_LIMITS.pushPreviewLength - 1)}…`
    : flat
}

/** Unread = messages from others after the member's read marker. */
export function isUnread(message: { seq: number; senderId: string | null }, viewerId: string, lastReadSeq: number) {
  return message.seq > lastReadSeq && message.senderId !== viewerId
}
