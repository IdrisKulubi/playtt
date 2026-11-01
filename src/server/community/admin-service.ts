// Ops moderation for Community (docs/community/README.md, M4): the reports
// queue, mute / hide actions, and excusing missed shared bookings.

import { and, desc, eq, inArray, isNull, lte, sql } from "drizzle-orm"
import { alias } from "drizzle-orm/pg-core"

import db from "@/db/drizzle"
import {
  bookings,
  communityMessages,
  communityReliabilityOverrides,
  communityReports,
  playAvailability,
  playerProfiles,
  resources,
  user,
} from "@/db/schema"
import type { TenantContext } from "@/server/tenancy/types"

import { loadSharedBookingFacts } from "./card-data.ts"
import { SOCIAL_LIMITS } from "./constants.ts"
import { CommunityError } from "./errors.ts"
import { reliabilityOutcome } from "./social-rules.ts"

export type CommunityReportAction = "review" | "mute" | "hide"

const reporter = alias(user, "reporter")
const target = alias(user, "target")

async function messageContext(messageId: string) {
  const [message] = await db
    .select({ conversationId: communityMessages.conversationId, seq: communityMessages.seq })
    .from(communityMessages)
    .where(eq(communityMessages.id, messageId))
    .limit(1)
  if (!message) return []

  // The reported message plus the two before it, oldest first.
  const rows = await db
    .select({
      id: communityMessages.id,
      senderId: communityMessages.senderId,
      body: communityMessages.body,
      kind: communityMessages.kind,
      createdAt: communityMessages.createdAt,
    })
    .from(communityMessages)
    .where(and(eq(communityMessages.conversationId, message.conversationId), lte(communityMessages.seq, message.seq)))
    .orderBy(desc(communityMessages.seq))
    .limit(3)

  return rows.reverse().map((row) => ({ ...row, reported: row.id === messageId, createdAt: row.createdAt.toISOString() }))
}

async function missedBookings(context: TenantContext, userId: string, now: Date) {
  const facts = (await loadSharedBookingFacts(context, [userId])).get(userId) ?? []
  const missed = facts.filter((fact) => reliabilityOutcome(fact, now) === "missed")
  if (missed.length === 0) return []

  const rows = await db
    .select({ id: bookings.id, startTime: bookings.startTime, resourceName: resources.name })
    .from(bookings)
    .innerJoin(resources, eq(resources.id, bookings.resourceId))
    .where(inArray(bookings.id, missed.map((fact) => fact.bookingId)))
    .orderBy(desc(bookings.startTime))

  return rows.map((row) => ({ bookingId: row.id, startsAt: row.startTime.toISOString(), resourceName: row.resourceName }))
}

export async function listCommunityReportsForAdmin(context: TenantContext) {
  const now = new Date()
  const rows = await db
    .select({
      id: communityReports.id,
      reason: communityReports.reason,
      note: communityReports.note,
      status: communityReports.status,
      createdAt: communityReports.createdAt,
      reviewedAt: communityReports.reviewedAt,
      messageId: communityReports.messageId,
      reporterId: reporter.id,
      reporterName: reporter.name,
      targetId: target.id,
      targetName: target.name,
      targetEmail: target.email,
      targetVisible: playerProfiles.communityVisible,
      targetMutedUntil: playerProfiles.mutedUntil,
    })
    .from(communityReports)
    .innerJoin(reporter, eq(reporter.id, communityReports.reporterId))
    .innerJoin(target, eq(target.id, communityReports.targetUserId))
    .leftJoin(playerProfiles, eq(playerProfiles.userId, communityReports.targetUserId))
    .where(eq(communityReports.tenantId, context.tenantId))
    // Open first, then newest.
    .orderBy(sql`case when ${communityReports.status} = 'open' then 0 else 1 end`, desc(communityReports.createdAt))
    .limit(100)

  return Promise.all(
    rows.map(async (row) => ({
      ...row,
      createdAt: row.createdAt.toISOString(),
      reviewedAt: row.reviewedAt?.toISOString() ?? null,
      targetMutedUntil: row.targetMutedUntil && row.targetMutedUntil > now ? row.targetMutedUntil.toISOString() : null,
      targetVisible: row.targetVisible ?? false,
      context: row.messageId ? await messageContext(row.messageId) : [],
      missedBookings: row.reason === "no_show" ? await missedBookings(context, row.targetId, now) : [],
    })),
  )
}

export async function applyCommunityReportAction(
  context: TenantContext,
  adminId: string,
  input: { reportId: string; action: CommunityReportAction },
) {
  const now = new Date()
  const [report] = await db
    .select({ id: communityReports.id, targetUserId: communityReports.targetUserId })
    .from(communityReports)
    .where(and(eq(communityReports.id, input.reportId), eq(communityReports.tenantId, context.tenantId)))
    .limit(1)

  if (!report) {
    throw new CommunityError("PLAYER_NOT_FOUND", "We could not find that report.", 404)
  }

  await db.transaction(async (tx) => {
    if (input.action === "mute") {
      const mutedUntil = new Date(now.getTime() + SOCIAL_LIMITS.muteDays * 24 * 60 * 60_000)
      await tx
        .update(playerProfiles)
        .set({ mutedUntil, updatedAt: now })
        .where(eq(playerProfiles.userId, report.targetUserId))
      // A muted player shouldn't stay listed as open to play.
      await tx
        .update(playAvailability)
        .set({ endedAt: now })
        .where(and(eq(playAvailability.userId, report.targetUserId), isNull(playAvailability.endedAt)))
    }

    if (input.action === "hide") {
      await tx
        .update(playerProfiles)
        .set({ communityVisible: false, updatedAt: now })
        .where(eq(playerProfiles.userId, report.targetUserId))
      await tx
        .update(playAvailability)
        .set({ endedAt: now })
        .where(and(eq(playAvailability.userId, report.targetUserId), isNull(playAvailability.endedAt)))
    }

    await tx
      .update(communityReports)
      .set({
        status: input.action === "review" ? "reviewed" : "actioned",
        reviewedBy: adminId,
        reviewedAt: now,
      })
      .where(eq(communityReports.id, report.id))
  })

  return { ok: true }
}

/** Ops marks a missed shared booking as excused so it doesn't lower REL. */
export async function excuseMissedBooking(
  context: TenantContext,
  adminId: string,
  input: { bookingId: string; userId: string; reason: string },
) {
  await db
    .insert(communityReliabilityOverrides)
    .values({
      tenantId: context.tenantId,
      bookingId: input.bookingId,
      userId: input.userId,
      reason: input.reason,
      createdBy: adminId,
    })
    .onConflictDoNothing()

  return { ok: true }
}
