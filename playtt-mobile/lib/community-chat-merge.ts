import type { BookingCardPayload, CommunityMessage } from "@/lib/community-types"

/** A message shown in the chat: a server message, or a local one still sending. */
export type ChatItem = CommunityMessage & {
  status: "sent" | "sending" | "failed"
}

export function fromServer(message: CommunityMessage): ChatItem {
  return { ...message, status: "sent" }
}

/** Optimistic local copy; `seq` is Infinity so it sorts after server messages. */
export function pendingItem(input: {
  clientMessageId: string
  conversationId: string
  kind: CommunityMessage["kind"]
  body: string
  payload?: CommunityMessage["payload"]
  now?: Date
}): ChatItem {
  return {
    id: `local:${input.clientMessageId}`,
    seq: Number.POSITIVE_INFINITY,
    conversationId: input.conversationId,
    senderId: null,
    mine: true,
    kind: input.kind,
    body: input.body,
    payload: input.payload ?? null,
    clientMessageId: input.clientMessageId,
    createdAt: (input.now ?? new Date()).toISOString(),
    status: "sending",
  }
}

/**
 * Merges server messages (from polling, paging or a send response) into the
 * list. Server copies replace local pending ones with the same clientMessageId,
 * duplicates are dropped and the result is ordered oldest → newest.
 */
export function mergeMessages(current: ChatItem[], incoming: CommunityMessage[]): ChatItem[] {
  if (incoming.length === 0) return current

  const byId = new Map<string, ChatItem>()
  const confirmedClientIds = new Set(
    incoming.map((message) => message.clientMessageId).filter((id): id is string => Boolean(id)),
  )

  for (const item of current) {
    if (item.status !== "sent" && item.clientMessageId && confirmedClientIds.has(item.clientMessageId)) {
      continue
    }
    byId.set(item.id, item)
  }

  for (const message of incoming) {
    byId.set(message.id, fromServer(message))
  }

  return [...byId.values()].sort((a, b) => {
    if (a.seq !== b.seq) return a.seq - b.seq
    return a.createdAt.localeCompare(b.createdAt)
  })
}

export function markFailed(current: ChatItem[], clientMessageId: string): ChatItem[] {
  return current.map((item) =>
    item.clientMessageId === clientMessageId && item.status === "sending" ? { ...item, status: "failed" } : item,
  )
}

export function markSending(current: ChatItem[], clientMessageId: string): ChatItem[] {
  return current.map((item) =>
    item.clientMessageId === clientMessageId && item.status === "failed" ? { ...item, status: "sending" } : item,
  )
}

/** Highest server seq in the list, used for `after=` polling. */
export function latestSeq(items: ChatItem[]) {
  let max = 0
  for (const item of items) {
    if (item.status === "sent" && item.seq > max) max = item.seq
  }
  return max
}

export function oldestSeq(items: ChatItem[]) {
  const sent = items.filter((item) => item.status === "sent")
  return sent.length > 0 ? sent[0].seq : undefined
}

/** Seq of my newest message the other player has read, for the "Seen" label. */
export function seenSeq(items: ChatItem[], otherLastReadSeq: number) {
  let seen: number | null = null
  for (const item of items) {
    if (item.mine && item.status === "sent" && item.seq <= otherLastReadSeq) seen = item.seq
  }
  return seen
}

export function isBookingCard(payload: CommunityMessage["payload"]): payload is BookingCardPayload {
  return Boolean(payload && typeof payload === "object" && "bookingId" in payload && "startsAt" in payload)
}

const NAIROBI_OFFSET_MS = 3 * 60 * 60 * 1000
const DAY_MS = 86_400_000

function nairobiDayIndex(date: Date) {
  return Math.floor((date.getTime() + NAIROBI_OFFSET_MS) / DAY_MS)
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

/** "Today", "Yesterday", "Tue", or "28 Oct", in Nairobi time. */
export function chatDayLabel(iso: string, now = new Date()) {
  const date = new Date(iso)
  const diff = nairobiDayIndex(now) - nairobiDayIndex(date)
  if (diff === 0) return "Today"
  if (diff === 1) return "Yesterday"
  const local = new Date(date.getTime() + NAIROBI_OFFSET_MS)
  if (diff > 1 && diff < 7) return WEEKDAYS[local.getUTCDay()]
  return `${local.getUTCDate()} ${MONTHS[local.getUTCMonth()]}`
}

/** Inbox timestamp: clock time today, otherwise the day label. */
export function inboxTimeLabel(iso: string, clock: (iso: string) => string, now = new Date()) {
  const label = chatDayLabel(iso, now)
  return label === "Today" ? clock(iso) : label
}

export function isSameNairobiDay(a: string, b: string) {
  return nairobiDayIndex(new Date(a)) === nairobiDayIndex(new Date(b))
}

export type ChatListRow = { type: "message"; item: ChatItem } | { type: "day"; key: string; label: string }

/** Newest-first rows for an inverted list, with day separators. */
export function chatRows(items: ChatItem[]): ChatListRow[] {
  const rows: ChatListRow[] = []
  for (let index = items.length - 1; index >= 0; index -= 1) {
    const item = items[index]
    rows.push({ type: "message", item })
    const older = items[index - 1]
    if (!older || !isSameNairobiDay(older.createdAt, item.createdAt)) {
      rows.push({ type: "day", key: `day:${item.id}`, label: chatDayLabel(item.createdAt) })
    }
  }
  return rows
}
