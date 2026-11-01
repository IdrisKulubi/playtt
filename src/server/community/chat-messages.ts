// Low-level helpers for server-written chat messages (system notes, kudos
// prompts). Kept separate so chat, social and notification code can share them
// without importing each other.

import { and, eq, inArray, sql } from "drizzle-orm"

import db from "@/db/drizzle"
import { communityConversationMembers, communityConversations, communityMessages } from "@/db/schema"

import { directConversationKey } from "./chat-rules.ts"

const DOUBLES_MAX_MEMBERS = 4

type Executor = Pick<typeof db, "insert" | "update" | "select">

export async function insertServerMessage(
  executor: Executor,
  input: {
    tenantId: string
    conversationId: string
    kind: "system" | "kudos_prompt"
    body: string
    payload?: Record<string, unknown> | null
  },
) {
  const [message] = await executor
    .insert(communityMessages)
    .values({
      tenantId: input.tenantId,
      conversationId: input.conversationId,
      senderId: null,
      kind: input.kind,
      body: input.body,
      payload: input.payload ?? null,
    })
    .returning()

  await executor
    .update(communityConversations)
    .set({ lastMessageAt: message.createdAt })
    .where(eq(communityConversations.id, input.conversationId))

  return message
}

export async function findDirectConversationId(tenantId: string, userA: string, userB: string) {
  const [row] = await db
    .select({ id: communityConversations.id })
    .from(communityConversations)
    .where(
      and(
        eq(communityConversations.tenantId, tenantId),
        eq(communityConversations.directKey, directConversationKey(userA, userB)),
      ),
    )
    .limit(1)
  return row?.id ?? null
}

export async function hasKudosPrompt(conversationId: string, bookingId: string) {
  const [row] = await db
    .select({ id: communityMessages.id })
    .from(communityMessages)
    .where(
      and(
        eq(communityMessages.conversationId, conversationId),
        eq(communityMessages.kind, "kudos_prompt"),
        sql`${communityMessages.payload} ->> 'bookingId' = ${bookingId}`,
      ),
    )
    .limit(1)
  return Boolean(row)
}

/** Members per doubles group, keyed by availability id (for "2v2 · 3/4"). */
export async function loadDoublesSpots(availabilityIds: string[]) {
  if (availabilityIds.length === 0) return new Map<string, { members: number; max: number }>()
  const rows = await db
    .select({
      availabilityId: communityConversations.availabilityId,
      max: communityConversations.maxMembers,
      members: sql<number>`count(${communityConversationMembers.userId}) filter (where ${communityConversationMembers.state} = 'active')::int`,
    })
    .from(communityConversations)
    .leftJoin(
      communityConversationMembers,
      eq(communityConversationMembers.conversationId, communityConversations.id),
    )
    .where(inArray(communityConversations.availabilityId, availabilityIds))
    .groupBy(communityConversations.availabilityId, communityConversations.maxMembers)

  return new Map(
    rows
      .filter((row) => row.availabilityId)
      .map((row) => [row.availabilityId!, { members: row.members, max: row.max ?? DOUBLES_MAX_MEMBERS }]),
  )
}
