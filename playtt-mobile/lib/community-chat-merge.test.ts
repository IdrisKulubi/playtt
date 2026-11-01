import {
  chatDayLabel,
  fromServer,
  latestSeq,
  markFailed,
  mergeMessages,
  oldestSeq,
  pendingItem,
  seenSeq,
} from "./community-chat-merge"
import type { CommunityMessage } from "./community-types"

function message(seq: number, overrides: Partial<CommunityMessage> = {}): CommunityMessage {
  return {
    id: `msg-${seq}`,
    seq,
    conversationId: "c1",
    senderId: "them",
    mine: false,
    kind: "text",
    body: `message ${seq}`,
    payload: null,
    clientMessageId: null,
    createdAt: new Date(Date.UTC(2026, 9, 28, 15, seq)).toISOString(),
    ...overrides,
  }
}

test("polling merges new messages in order and drops duplicates", () => {
  const current = [message(1), message(2)].map(fromServer)
  const merged = mergeMessages(current, [message(2), message(4), message(3)])
  expect(merged.map((item) => item.seq)).toEqual([1, 2, 3, 4])
})

test("server copy replaces the optimistic message with the same clientMessageId", () => {
  const local = pendingItem({ clientMessageId: "m-abc12345", conversationId: "c1", kind: "text", body: "On my way" })
  const current = [fromServer(message(1)), local]
  expect(current[1].status).toBe("sending")

  const merged = mergeMessages(current, [
    message(2, { mine: true, senderId: "me", body: "On my way", clientMessageId: "m-abc12345" }),
  ])
  expect(merged).toHaveLength(2)
  expect(merged[1]).toMatchObject({ id: "msg-2", status: "sent", body: "On my way" })
})

test("pending messages stay after server messages until confirmed", () => {
  const local = pendingItem({ clientMessageId: "m-pending01", conversationId: "c1", kind: "text", body: "hi" })
  const merged = mergeMessages([local], [message(5)])
  expect(merged.map((item) => item.id)).toEqual(["msg-5", "local:m-pending01"])
  expect(latestSeq(merged)).toBe(5)
  expect(oldestSeq(merged)).toBe(5)
})

test("failed sends are marked for retry", () => {
  const local = pendingItem({ clientMessageId: "m-fail0001", conversationId: "c1", kind: "text", body: "hi" })
  expect(markFailed([local], "m-fail0001")[0].status).toBe("failed")
})

test("seen marker points at my newest message the other player read", () => {
  const items = [
    message(1, { mine: true }),
    message(2),
    message(3, { mine: true }),
    message(4, { mine: true }),
  ].map(fromServer)
  expect(seenSeq(items, 3)).toBe(3)
  expect(seenSeq(items, 0)).toBeNull()
})

test("day labels use Nairobi dates", () => {
  const now = new Date("2026-10-28T12:00:00.000Z") // Wed 15:00 Nairobi
  expect(chatDayLabel("2026-10-28T05:00:00.000Z", now)).toBe("Today")
  // 22:30Z on the 27th is already 01:30 on the 28th in Nairobi.
  expect(chatDayLabel("2026-10-27T22:30:00.000Z", now)).toBe("Today")
  expect(chatDayLabel("2026-10-27T12:00:00.000Z", now)).toBe("Yesterday")
  expect(chatDayLabel("2026-10-25T12:00:00.000Z", now)).toBe("Sun")
  expect(chatDayLabel("2026-10-01T12:00:00.000Z", now)).toBe("1 Oct")
})
