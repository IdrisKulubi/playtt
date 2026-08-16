import { and, desc, eq, lt } from "drizzle-orm"

import db from "@/db/drizzle"
import {
  coachInsights,
  coachSubscriptions,
  coachTrainingItems,
  productPayments,
  replays,
  user,
} from "@/db/schema"
import {
  COACH_PLAN_ID,
  COACH_SUBSCRIPTION_PERIOD_DAYS,
} from "@/server/coach/constants"

export async function getCoachSubscription(userId: string) {
  const [row] = await db
    .select()
    .from(coachSubscriptions)
    .where(eq(coachSubscriptions.userId, userId))
    .limit(1)

  return row ?? null
}

export async function isCoachActive(userId: string) {
  const now = new Date()
  const subscription = await getCoachSubscription(userId)

  if (!subscription) {
    return false
  }

  if (subscription.status !== "active") {
    return false
  }

  return subscription.currentPeriodEnd > now
}

export async function activateCoachSubscription(input: {
  userId: string
  productPaymentId?: string
  paystackSubscriptionCode?: string | null
}) {
  const periodEnd = new Date()
  periodEnd.setDate(periodEnd.getDate() + COACH_SUBSCRIPTION_PERIOD_DAYS)

  const [row] = await db
    .insert(coachSubscriptions)
    .values({
      userId: input.userId,
      status: "active",
      planId: COACH_PLAN_ID,
      paystackSubscriptionCode: input.paystackSubscriptionCode ?? null,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: false,
    })
    .onConflictDoUpdate({
      target: coachSubscriptions.userId,
      set: {
        status: "active",
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: false,
        updatedAt: new Date(),
      },
    })
    .returning()

  return row
}

export async function confirmCoachSubscriptionActivation(input: {
  paymentId: string
  userId: string
  paidAt: Date
  providerEventId?: string | null
  rawPayload: Record<string, unknown>
}) {
  const periodEnd = new Date()
  periodEnd.setDate(periodEnd.getDate() + COACH_SUBSCRIPTION_PERIOD_DAYS)

  return db.transaction(async (tx) => {
    const [lockedPayment] = await tx
      .select({
        productType: productPayments.productType,
        status: productPayments.status,
      })
      .from(productPayments)
      .where(
        and(
          eq(productPayments.id, input.paymentId),
          eq(productPayments.userId, input.userId)
        )
      )
      .for("update")
      .limit(1)

    if (!lockedPayment || lockedPayment.productType !== "coach_subscription") {
      return "state_changed" as const
    }

    if (lockedPayment.status === "paid") {
      const [existingSubscription] = await tx
        .select({ id: coachSubscriptions.id })
        .from(coachSubscriptions)
        .where(eq(coachSubscriptions.userId, input.userId))
        .limit(1)

      if (existingSubscription) {
        return "already_confirmed" as const
      }

      const [recoveredSubscription] = await tx
        .insert(coachSubscriptions)
        .values({
          userId: input.userId,
          status: "active",
          planId: COACH_PLAN_ID,
          currentPeriodEnd: periodEnd,
          cancelAtPeriodEnd: false,
        })
        .onConflictDoNothing()
        .returning({ id: coachSubscriptions.id })

      return recoveredSubscription
        ? ("confirmed" as const)
        : ("already_confirmed" as const)
    }

    if (lockedPayment.status !== "pending") {
      return "state_changed" as const
    }

    const [claimedPayment] = await tx
      .update(productPayments)
      .set({
        status: "paid",
        paidAt: input.paidAt,
        providerEventId: input.providerEventId ?? null,
        rawPayload: input.rawPayload,
      })
      .where(
        and(
          eq(productPayments.id, input.paymentId),
          eq(productPayments.userId, input.userId),
          eq(productPayments.productType, "coach_subscription"),
          eq(productPayments.status, "pending")
        )
      )
      .returning({ id: productPayments.id })

    if (!claimedPayment) {
      return "state_changed" as const
    }

    await tx
      .insert(coachSubscriptions)
      .values({
        userId: input.userId,
        status: "active",
        planId: COACH_PLAN_ID,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: false,
      })
      .onConflictDoUpdate({
        target: coachSubscriptions.userId,
        set: {
          status: "active",
          planId: COACH_PLAN_ID,
          currentPeriodEnd: periodEnd,
          cancelAtPeriodEnd: false,
          updatedAt: new Date(),
        },
      })

    return "confirmed" as const
  })
}

export async function cancelCoachAtPeriodEnd(userId: string) {
  const [row] = await db
    .update(coachSubscriptions)
    .set({ cancelAtPeriodEnd: true, updatedAt: new Date() })
    .where(eq(coachSubscriptions.userId, userId))
    .returning()

  return row ?? null
}

export async function listCoachInsights(userId: string) {
  return db
    .select({
      id: coachInsights.id,
      replayId: coachInsights.replayId,
      bookingId: coachInsights.bookingId,
      summary: coachInsights.summary,
      focusAreas: coachInsights.focusAreas,
      createdAt: coachInsights.createdAt,
      replayTitle: replays.metadata,
    })
    .from(coachInsights)
    .innerJoin(replays, eq(coachInsights.replayId, replays.id))
    .where(eq(coachInsights.userId, userId))
    .orderBy(desc(coachInsights.createdAt))
}

export async function getCoachInsightById(input: {
  userId: string
  insightId: string
}) {
  const [insight] = await db
    .select({
      id: coachInsights.id,
      replayId: coachInsights.replayId,
      bookingId: coachInsights.bookingId,
      summary: coachInsights.summary,
      focusAreas: coachInsights.focusAreas,
      createdAt: coachInsights.createdAt,
      replayTitle: replays.metadata,
    })
    .from(coachInsights)
    .innerJoin(replays, eq(coachInsights.replayId, replays.id))
    .where(
      and(
        eq(coachInsights.id, input.insightId),
        eq(coachInsights.userId, input.userId)
      )
    )
    .limit(1)

  if (!insight) {
    return null
  }

  const training = await db
    .select()
    .from(coachTrainingItems)
    .where(eq(coachTrainingItems.insightId, insight.id))
    .orderBy(coachTrainingItems.sortOrder)

  return { insight, training }
}

export async function listCoachTraining(userId: string) {
  return db
    .select()
    .from(coachTrainingItems)
    .where(eq(coachTrainingItems.userId, userId))
    .orderBy(coachTrainingItems.sortOrder)
}

export async function insertCoachInsight(input: {
  userId: string
  replayId: string
  bookingId: string
  summary: string
  focusAreas: string[]
  trainingItems: Array<{
    title: string
    description: string
    durationMinutes?: number | null
    sortOrder: number
  }>
}) {
  return db.transaction(async (tx) => {
    const [insight] = await tx
      .insert(coachInsights)
      .values({
        userId: input.userId,
        replayId: input.replayId,
        bookingId: input.bookingId,
        summary: input.summary,
        focusAreas: input.focusAreas,
      })
      .onConflictDoNothing()
      .returning()

    if (!insight) {
      const [existing] = await tx
        .select()
        .from(coachInsights)
        .where(eq(coachInsights.replayId, input.replayId))
        .limit(1)

      return existing ?? null
    }

    if (input.trainingItems.length > 0) {
      await tx.insert(coachTrainingItems).values(
        input.trainingItems.map((item) => ({
          userId: input.userId,
          insightId: insight.id,
          title: item.title,
          description: item.description,
          durationMinutes: item.durationMinutes ?? null,
          sortOrder: item.sortOrder,
        }))
      )
    }

    return insight
  })
}

export async function findProductPaymentByReference(reference: string) {
  const [row] = await db
    .select()
    .from(productPayments)
    .where(
      and(
        eq(productPayments.provider, "paystack"),
        eq(productPayments.providerReference, reference)
      )
    )
    .limit(1)

  return row ?? null
}

export async function getUserEmail(userId: string) {
  const [row] = await db
    .select({ email: user.email })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1)

  return row?.email ?? null
}

export async function expireCoachSubscriptions() {
  const now = new Date()

  await db
    .update(coachSubscriptions)
    .set({ status: "expired", updatedAt: new Date() })
    .where(
      and(
        eq(coachSubscriptions.status, "active"),
        eq(coachSubscriptions.cancelAtPeriodEnd, true),
        lt(coachSubscriptions.currentPeriodEnd, now)
      )
    )
}
