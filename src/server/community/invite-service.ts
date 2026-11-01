// WhatsApp invites (docs/community/README.md, M5): shareable codes that turn
// the inviter and the new player into instant Rally Partners.

import { randomInt } from "node:crypto"

import { and, eq, gt, isNull, sql } from "drizzle-orm"

import db from "@/db/drizzle"
import {
  communityConversationMembers,
  communityConversations,
  communityInvites,
  follows,
  playerProfiles,
  user,
} from "@/db/schema"
import type { TenantContext } from "@/server/tenancy/types"

import { loadCardData } from "./card-data.ts"
import { insertServerMessage } from "./chat-messages.ts"
import { directConversationKey } from "./chat-rules.ts"
import { toCommunityDisplayName } from "./display-name.ts"
import { CommunityError } from "./errors.ts"
import { generateInviteCode, GROUP_LIMITS, normalizeInviteCode } from "./rating-rules.ts"

function appBaseUrl() {
  const base = process.env.NEXT_PUBLIC_APP_URL || process.env.BETTER_AUTH_URL || "https://playtt.app"
  return base.replace(/\/+$/, "")
}

export function inviteUrl(code: string) {
  return `${appBaseUrl()}/invite/${code}`
}

export async function createInvite(context: TenantContext, viewerId: string) {
  const since = new Date(Date.now() - 24 * 60 * 60_000)
  const [today] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(communityInvites)
    .where(and(eq(communityInvites.inviterId, viewerId), gt(communityInvites.createdAt, since)))

  if ((today?.count ?? 0) >= GROUP_LIMITS.invitesPerDay) {
    throw new CommunityError("RATE_LIMITED", "You've made a lot of invites today. Try again tomorrow.", 429)
  }

  // 32^8 codes: a clash is very unlikely, but retry a few times anyway.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = generateInviteCode((max) => randomInt(max))
    const [row] = await db
      .insert(communityInvites)
      .values({ tenantId: context.tenantId, code, inviterId: viewerId })
      .onConflictDoNothing()
      .returning({ code: communityInvites.code })
    if (row) return { invite: { code: row.code, url: inviteUrl(row.code) } }
  }

  throw new Error("Could not generate a unique invite code.")
}

/** Public view for the invite landing page: the inviter's card, nothing private. */
export async function getInviteForLanding(rawCode: string) {
  const code = normalizeInviteCode(rawCode)
  if (!code) return null

  const [row] = await db
    .select({
      code: communityInvites.code,
      tenantId: communityInvites.tenantId,
      acceptedAt: communityInvites.acceptedAt,
      inviterId: user.id,
      inviterName: user.name,
      skillLevel: user.skillLevel,
      communityVisible: playerProfiles.communityVisible,
    })
    .from(communityInvites)
    .innerJoin(user, eq(user.id, communityInvites.inviterId))
    .leftJoin(playerProfiles, eq(playerProfiles.userId, communityInvites.inviterId))
    .where(eq(communityInvites.code, code))
    .limit(1)

  if (!row) return null

  // Card stats only when the inviter has a visible Community card.
  const card = row.communityVisible
    ? (
        await loadCardData(
          { tenantId: row.tenantId } as TenantContext,
          [row.inviterId],
          new Date(),
        )
      ).get(row.inviterId)
    : undefined

  return {
    code: row.code,
    used: Boolean(row.acceptedAt),
    inviter: {
      displayName: toCommunityDisplayName(row.inviterName),
      skillLevel: row.skillLevel,
      stats: card?.stats ?? null,
      badges: card?.badges ?? [],
    },
  }
}

/**
 * The new player accepts: both follow each other (instant Rally Partners) and
 * a DM opens with a welcome note. Single use.
 */
export async function acceptInvite(context: TenantContext, viewerId: string, rawCode: string) {
  const code = normalizeInviteCode(rawCode)
  const invalid = (): never => {
    throw new CommunityError("PLAYER_NOT_FOUND", "That invite code isn't valid or has already been used.", 404)
  }
  if (!code) invalid()

  const [invite] = await db
    .select()
    .from(communityInvites)
    .where(and(eq(communityInvites.code, code!), eq(communityInvites.tenantId, context.tenantId)))
    .limit(1)

  if (!invite) invalid()
  if (invite.inviterId === viewerId) {
    throw new CommunityError("CANNOT_TARGET_SELF", "That's your own invite. Share it with a friend.", 400)
  }

  const now = new Date()
  const [inviter] = await db.select({ name: user.name }).from(user).where(eq(user.id, invite.inviterId)).limit(1)

  const conversationId = await db.transaction(async (tx) => {
    const [claimed] = await tx
      .update(communityInvites)
      .set({ acceptedBy: viewerId, acceptedAt: now })
      .where(and(eq(communityInvites.id, invite.id), isNull(communityInvites.acceptedBy)))
      .returning({ id: communityInvites.id })
    if (!claimed) invalid()

    await tx
      .insert(follows)
      .values([
        { tenantId: context.tenantId, followerId: viewerId, followeeId: invite.inviterId },
        { tenantId: context.tenantId, followerId: invite.inviterId, followeeId: viewerId },
      ])
      .onConflictDoNothing()

    const directKey = directConversationKey(viewerId, invite.inviterId)
    await tx
      .insert(communityConversations)
      .values({ tenantId: context.tenantId, type: "direct", directKey, createdBy: viewerId })
      .onConflictDoNothing()
    const [conversation] = await tx
      .select({ id: communityConversations.id })
      .from(communityConversations)
      .where(and(eq(communityConversations.tenantId, context.tenantId), eq(communityConversations.directKey, directKey)))
      .limit(1)

    await tx
      .insert(communityConversationMembers)
      .values([
        { conversationId: conversation.id, tenantId: context.tenantId, userId: viewerId, state: "active", acceptedAt: now },
        {
          conversationId: conversation.id,
          tenantId: context.tenantId,
          userId: invite.inviterId,
          state: "active",
          acceptedAt: now,
        },
      ])
      .onConflictDoUpdate({
        target: [communityConversationMembers.conversationId, communityConversationMembers.userId],
        set: { state: "active", acceptedAt: now },
      })

    await insertServerMessage(tx, {
      tenantId: context.tenantId,
      conversationId: conversation.id,
      kind: "system",
      body: `You joined from ${toCommunityDisplayName(inviter?.name)}'s invite. Say hi! 🏓`,
      payload: { event: "invite_accepted", inviteCode: code },
    })

    return conversation.id
  })

  return { conversationId, inviterId: invite.inviterId }
}
