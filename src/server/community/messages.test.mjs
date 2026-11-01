import assert from "node:assert/strict"
import test from "node:test"

import {
  decideSend,
  directConversationKey,
  followeeOpenDeduplicationKey,
  initialRecipientState,
  isUnread,
  messagePushDeduplicationKey,
  pushPreview,
} from "./chat-rules.ts"
import { filterMessageBody } from "./message-filter.ts"
import { consumeCommunityRateLimit, resetCommunityRateLimits } from "./rate-limit.ts"

function send(overrides = {}) {
  return decideSend({
    senderState: "active",
    recipientState: "active",
    recipientAccepted: true,
    senderMessagesWhilePending: 0,
    ...overrides,
  })
}

test("one direct conversation per pair, whoever starts it", () => {
  assert.equal(directConversationKey("b", "a"), directConversationKey("a", "b"))
  assert.equal(directConversationKey("user_2", "user_1"), "user_1:user_2")
})

test("first DMs go to Requests unless the recipient follows the sender", () => {
  assert.equal(initialRecipientState(false), "request")
  assert.equal(initialRecipientState(true), "active")
})

test("senders get three messages before a request is accepted", () => {
  for (let sent = 0; sent < 3; sent += 1) {
    assert.deepEqual(send({ recipientState: "request", recipientAccepted: false, senderMessagesWhilePending: sent }), {
      ok: true,
      recipientState: "request",
      acceptRequest: false,
    })
  }
  assert.deepEqual(
    send({ recipientState: "request", recipientAccepted: false, senderMessagesWhilePending: 3 }),
    { ok: false, code: "REQUEST_LIMIT_REACHED" },
  )
})

test("replying from the Requests folder accepts the request", () => {
  assert.deepEqual(send({ senderState: "request" }), { ok: true, recipientState: "active", acceptRequest: true })
})

test("a deleted chat comes back only if it had been accepted", () => {
  assert.equal(send({ recipientState: "left", recipientAccepted: true }).recipientState, "active")
  const hidden = send({ recipientState: "left", recipientAccepted: false, senderMessagesWhilePending: 1 })
  assert.equal(hidden.ok && hidden.recipientState, "left")
  // The request limit still applies to a hidden, never-accepted request.
  assert.equal(send({ recipientState: "left", recipientAccepted: false, senderMessagesWhilePending: 3 }).ok, false)
})

test("message pushes collapse within a 60 s window per conversation and recipient", () => {
  const at = (iso) => new Date(iso)
  const first = messagePushDeduplicationKey("c1", "u2", at("2026-10-28T10:00:05Z"))
  assert.equal(messagePushDeduplicationKey("c1", "u2", at("2026-10-28T10:00:55Z")), first)
  assert.notEqual(messagePushDeduplicationKey("c1", "u2", at("2026-10-28T10:01:05Z")), first)
  assert.notEqual(messagePushDeduplicationKey("c1", "u3", at("2026-10-28T10:00:05Z")), first)
  assert.notEqual(messagePushDeduplicationKey("c2", "u2", at("2026-10-28T10:00:05Z")), first)
})

test("followee-open pushes are capped per recipient per 6 hours", () => {
  const key = followeeOpenDeduplicationKey("u2", new Date("2026-10-28T06:10:00Z"))
  assert.equal(followeeOpenDeduplicationKey("u2", new Date("2026-10-28T11:50:00Z")), key)
  assert.notEqual(followeeOpenDeduplicationKey("u2", new Date("2026-10-28T12:10:00Z")), key)
})

test("push previews are flattened and truncated", () => {
  assert.equal(pushPreview("Free\n at   7?"), "Free at 7?")
  const long = pushPreview("x".repeat(300))
  assert.equal(long.length, 120)
  assert.ok(long.endsWith("…"))
})

test("unread counts only other people's messages after the read marker", () => {
  assert.equal(isUnread({ seq: 5, senderId: "other" }, "me", 4), true)
  assert.equal(isUnread({ seq: 5, senderId: "me" }, "me", 4), false)
  assert.equal(isUnread({ seq: 4, senderId: "other" }, "me", 4), false)
  assert.equal(isUnread({ seq: 6, senderId: null }, "me", 4), true)
})

test("filter masks slurs, including look-alike spellings", () => {
  const result = filterMessageBody("you f4ggot, see you at 7")
  assert.equal(result.ok, true)
  assert.equal(result.masked, true)
  assert.equal(result.body, "you f*****, see you at 7")
  assert.deepEqual(filterMessageBody("Good game! See you Saturday"), {
    ok: true,
    body: "Good game! See you Saturday",
    masked: false,
  })
})

test("filter rejects empty and link-only messages but keeps links with text", () => {
  assert.deepEqual(filterMessageBody("   "), { ok: false, reason: "EMPTY" })
  assert.deepEqual(filterMessageBody("https://spam.example.com/win"), { ok: false, reason: "LINK_ONLY" })
  assert.deepEqual(filterMessageBody("www.bit.ly/x !!"), { ok: false, reason: "LINK_ONLY" })
  assert.equal(filterMessageBody("Directions: https://maps.example.com/parklands").ok, true)
})

test("message rate limit allows 30 per minute", () => {
  resetCommunityRateLimits()
  const start = 5_000_000
  for (let i = 0; i < 30; i += 1) {
    assert.equal(consumeCommunityRateLimit("message", "u1", start), true)
  }
  assert.equal(consumeCommunityRateLimit("message", "u1", start + 1_000), false)
  assert.equal(consumeCommunityRateLimit("message", "u1", start + 60_000), true)
})
