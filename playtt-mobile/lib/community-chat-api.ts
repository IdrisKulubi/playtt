import { apiFetch } from "@/lib/api-client"
import type {
  CommunityConversation,
  CommunityGroup,
  CommunityGroupMessage,
  CommunityGroupMessagesPage,
  CommunityMessage,
  CommunityMessagesPage,
  CommunityUnreadCounts,
  ConversationFolder,
  SendMessageInput,
} from "@/lib/community-types"

type Envelope<T> = { data: T }

const BASE = "/api/v1/community/conversations"

function conversationPath(conversationId: string, suffix = "") {
  return `${BASE}/${encodeURIComponent(conversationId)}${suffix}`
}

/** Random id so a retried send is stored once (server dedupes on it). */
export function newClientMessageId() {
  const random = Math.random().toString(36).slice(2, 10)
  return `m-${Date.now().toString(36)}-${random}`
}

export async function fetchConversations(folder: ConversationFolder, cursor?: string) {
  const query = new URLSearchParams({ folder })
  if (cursor) query.set("cursor", cursor)
  const response = await apiFetch<
    Envelope<{ conversations: CommunityConversation[]; nextCursor: string | null }>
  >(`${BASE}?${query.toString()}`)
  return response.data
}

export async function startConversation(userId: string) {
  const response = await apiFetch<Envelope<{ conversation: CommunityConversation }>>(BASE, {
    method: "POST",
    body: JSON.stringify({ userId }),
  })
  return response.data.conversation
}

export async function fetchMessages(conversationId: string, cursor: { before?: number; after?: number } = {}) {
  const query = new URLSearchParams()
  if (cursor.before !== undefined) query.set("before", String(cursor.before))
  if (cursor.after !== undefined) query.set("after", String(cursor.after))
  const search = query.toString()
  const suffix = search ? `/messages?${search}` : "/messages"
  const response = await apiFetch<Envelope<CommunityMessagesPage>>(conversationPath(conversationId, suffix))
  return response.data
}

export async function sendCommunityMessage(conversationId: string, input: SendMessageInput) {
  const response = await apiFetch<Envelope<{ message: CommunityMessage }>>(
    conversationPath(conversationId, "/messages"),
    { method: "POST", body: JSON.stringify(input) },
  )
  return response.data.message
}

export async function markConversationRead(conversationId: string, seq: number) {
  await apiFetch(conversationPath(conversationId, "/read"), {
    method: "POST",
    body: JSON.stringify({ seq }),
  })
}

export async function acceptConversation(conversationId: string) {
  const response = await apiFetch<Envelope<{ conversation: CommunityConversation }>>(
    conversationPath(conversationId, "/accept"),
    { method: "POST" },
  )
  return response.data.conversation
}

export async function leaveConversation(conversationId: string) {
  await apiFetch(conversationPath(conversationId), { method: "DELETE" })
}

export async function fetchUnreadCounts() {
  const response = await apiFetch<Envelope<{ unread: CommunityUnreadCounts }>>("/api/v1/community/unread")
  return response.data.unread
}

// --- Groups (M5) ---

const GROUPS = "/api/v1/community/groups"

function groupPath(groupId: string, suffix = "") {
  return `${GROUPS}/${encodeURIComponent(groupId)}${suffix}`
}

export async function fetchGroups() {
  const response = await apiFetch<Envelope<{ groups: CommunityGroup[] }>>(GROUPS)
  return response.data.groups
}

export async function fetchGroupMessages(groupId: string, cursor: { before?: number; after?: number } = {}) {
  const query = new URLSearchParams()
  if (cursor.before !== undefined) query.set("before", String(cursor.before))
  if (cursor.after !== undefined) query.set("after", String(cursor.after))
  const search = query.toString()
  const response = await apiFetch<Envelope<CommunityGroupMessagesPage>>(
    groupPath(groupId, search ? `/messages?${search}` : "/messages"),
  )
  return response.data
}

export async function sendGroupMessage(
  groupId: string,
  input: { kind: "text" | "quick_reply"; body: string; clientMessageId: string },
) {
  const response = await apiFetch<Envelope<{ message: CommunityGroupMessage }>>(groupPath(groupId, "/messages"), {
    method: "POST",
    body: JSON.stringify(input),
  })
  return response.data.message
}

export async function markGroupRead(groupId: string, seq: number) {
  await apiFetch(groupPath(groupId, "/read"), { method: "POST", body: JSON.stringify({ seq }) })
}

export async function muteGroup(groupId: string, hours: 1 | 8 | 24 | 168 | null) {
  const response = await apiFetch<Envelope<{ mutedUntil: string | null }>>(groupPath(groupId, "/mute"), {
    method: "POST",
    body: JSON.stringify({ hours }),
  })
  return response.data.mutedUntil
}

export async function leaveGroup(groupId: string) {
  await apiFetch(groupPath(groupId), { method: "DELETE" })
}

export async function removeGroupMember(groupId: string, memberId: string) {
  await apiFetch(groupPath(groupId, `/members/${encodeURIComponent(memberId)}`), { method: "DELETE" })
}
