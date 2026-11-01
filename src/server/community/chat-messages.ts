// Low-level helpers for server-written chat messages (system notes, kudos
// prompts). Kept separate so chat, social and notification code can share them
// without importing each other.

import { and, eq, sql } from "drizzle-orm"

import db from "@/db/drizzle"
import { communityConversations, communityMessages } from "@/db/schema"

import { directConversationKey } from "./chat-rules.ts"

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
