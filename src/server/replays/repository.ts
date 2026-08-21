import { and, desc, eq } from "drizzle-orm"

import db from "@/db/drizzle"
import {
  bookings,
  locations,
  productPayments,
  replayCreditBalances,
  replayCreditLedger,
  replays,
  user,
} from "@/db/schema"
import { REPLAY_PACK_CREDITS } from "@/server/replays/constants"
import type { TenantContext } from "@/server/tenancy/types"

export async function getOrCreateCreditBalance(
  context: TenantContext,
  userId: string,
) {
  const [existing] = await db
    .select()
    .from(replayCreditBalances)
    .where(
      and(
        eq(replayCreditBalances.tenantId, context.tenantId),
        eq(replayCreditBalances.userId, userId),
      ),
    )
    .limit(1)

  if (existing) {
    return existing
  }

  const [created] = await db
    .insert(replayCreditBalances)
    .values({ tenantId: context.tenantId, userId, balance: 0 })
    .onConflictDoNothing()
    .returning()

  if (created) {
    return created
  }

  const [row] = await db
    .select()
    .from(replayCreditBalances)
    .where(
      and(
        eq(replayCreditBalances.tenantId, context.tenantId),
        eq(replayCreditBalances.userId, userId),
      ),
    )
    .limit(1)

  return row!
}

export async function getLastPackPurchaseAt(
  context: TenantContext,
  userId: string,
) {
  const [row] = await db
    .select({ paidAt: productPayments.paidAt })
    .from(productPayments)
    .where(
      and(
        eq(productPayments.tenantId, context.tenantId),
        eq(productPayments.userId, userId),
        eq(productPayments.productType, "replay_pack"),
        eq(productPayments.status, "paid"),
      ),
    )
    .orderBy(desc(productPayments.paidAt))
    .limit(1)

  return row?.paidAt ?? null
}

export async function insertProductPayment(
  context: TenantContext,
  input: {
    userId: string
    productType: "replay_pack" | "coach_subscription"
    providerReference: string
    amount: string
    currency: string
    rawPayload: Record<string, unknown>
  },
) {
  const [row] = await db
    .insert(productPayments)
    .values({
      tenantId: context.tenantId,
      userId: input.userId,
      productType: input.productType,
      providerReference: input.providerReference,
      amount: input.amount,
      currency: input.currency,
      rawPayload: input.rawPayload,
    })
    .returning()

  return row
}

export async function findProductPaymentByReference(reference: string) {
  const [row] = await db
    .select()
    .from(productPayments)
    .where(
      and(
        eq(productPayments.provider, "paystack"),
        eq(productPayments.providerReference, reference),
      ),
    )
    .limit(1)

  return row ?? null
}

export async function creditPackPurchase(
  context: TenantContext,
  input: {
    userId: string
    productPaymentId: string
    credits?: number
  },
) {
  const credits = input.credits ?? REPLAY_PACK_CREDITS

  return db.transaction(async (tx) => {
    await tx
      .insert(replayCreditBalances)
      .values({ tenantId: context.tenantId, userId: input.userId, balance: 0 })
      .onConflictDoNothing()

    const [balanceRow] = await tx
      .select()
      .from(replayCreditBalances)
      .where(
        and(
          eq(replayCreditBalances.tenantId, context.tenantId),
          eq(replayCreditBalances.userId, input.userId),
        ),
      )
      .for("update")
      .limit(1)

    const currentBalance = balanceRow?.balance ?? 0
    const nextBalance = currentBalance + credits

    await tx
      .update(replayCreditBalances)
      .set({ balance: nextBalance, updatedAt: new Date() })
      .where(
        and(
          eq(replayCreditBalances.tenantId, context.tenantId),
          eq(replayCreditBalances.userId, input.userId),
        ),
      )

    await tx.insert(replayCreditLedger).values({
      tenantId: context.tenantId,
      userId: input.userId,
      delta: credits,
      reason: "pack_purchase",
      productPaymentId: input.productPaymentId,
    })

    return nextBalance
  })
}

export async function confirmAndCreditPackPurchase(
  context: TenantContext,
  input: {
    productPaymentId: string
    paidAt: Date
    providerEventId?: string | null
    rawPayload: Record<string, unknown>
  },
) {
  return db.transaction(async (tx) => {
    const [payment] = await tx
      .select()
      .from(productPayments)
      .where(
        and(
          eq(productPayments.tenantId, context.tenantId),
          eq(productPayments.id, input.productPaymentId),
        ),
      )
      .for("update")
      .limit(1)

    if (!payment) {
      return "payment_not_found" as const
    }

    if (payment.status !== "paid") {
      const [claimed] = await tx
        .update(productPayments)
        .set({
          status: "paid",
          paidAt: input.paidAt,
          providerEventId: input.providerEventId ?? payment.providerEventId,
          rawPayload: input.rawPayload,
        })
        .where(
          and(
            eq(productPayments.tenantId, context.tenantId),
            eq(productPayments.id, payment.id),
            eq(productPayments.status, payment.status),
          ),
        )
        .returning({ id: productPayments.id })

      if (!claimed) {
        throw new Error(
          "Product payment status changed while confirming pack purchase.",
        )
      }
    }

    const [existingCredit] = await tx
      .select({ id: replayCreditLedger.id })
      .from(replayCreditLedger)
      .where(
        and(
          eq(replayCreditLedger.tenantId, context.tenantId),
          eq(replayCreditLedger.productPaymentId, payment.id),
          eq(replayCreditLedger.reason, "pack_purchase"),
        ),
      )
      .limit(1)

    if (existingCredit) {
      return "already_credited" as const
    }

    await tx
      .insert(replayCreditBalances)
      .values({ tenantId: context.tenantId, userId: payment.userId, balance: 0 })
      .onConflictDoNothing()

    const [balanceRow] = await tx
      .select()
      .from(replayCreditBalances)
      .where(
        and(
          eq(replayCreditBalances.tenantId, context.tenantId),
          eq(replayCreditBalances.userId, payment.userId),
        ),
      )
      .for("update")
      .limit(1)

    const nextBalance = (balanceRow?.balance ?? 0) + REPLAY_PACK_CREDITS

    await tx
      .update(replayCreditBalances)
      .set({ balance: nextBalance, updatedAt: new Date() })
      .where(
        and(
          eq(replayCreditBalances.tenantId, context.tenantId),
          eq(replayCreditBalances.userId, payment.userId),
        ),
      )

    await tx.insert(replayCreditLedger).values({
      tenantId: context.tenantId,
      userId: payment.userId,
      delta: REPLAY_PACK_CREDITS,
      reason: "pack_purchase",
      productPaymentId: payment.id,
    })

    return "credited" as const
  })
}

export async function debitReplayCredit(
  context: TenantContext,
  input: {
    userId: string
    bookingId: string
    locationId: string
  },
) {
  return db.transaction(async (tx) => {
    const [balanceRow] = await tx
      .select()
      .from(replayCreditBalances)
      .where(
        and(
          eq(replayCreditBalances.tenantId, context.tenantId),
          eq(replayCreditBalances.userId, input.userId),
        ),
      )
      .for("update")
      .limit(1)

    const balance = balanceRow?.balance ?? 0

    if (balance <= 0) {
      return { ok: false as const, reason: "no_credits" as const }
    }

    const [replay] = await tx
      .insert(replays)
      .values({
        tenantId: context.tenantId,
        bookingId: input.bookingId,
        locationId: input.locationId,
        userId: input.userId,
        status: "queued",
        metadata: { source: "venue_replay_button" },
      })
      .returning()

    const [ledger] = await tx
      .insert(replayCreditLedger)
      .values({
        tenantId: context.tenantId,
        userId: input.userId,
        delta: -1,
        reason: "replay_capture",
        bookingId: input.bookingId,
        replayId: replay.id,
      })
      .returning()

    await tx
      .update(replayCreditBalances)
      .set({ balance: balance - 1, updatedAt: new Date() })
      .where(
        and(
          eq(replayCreditBalances.tenantId, context.tenantId),
          eq(replayCreditBalances.userId, input.userId),
        ),
      )

    return {
      ok: true as const,
      replay,
      ledgerId: ledger.id,
      remainingCredits: balance - 1,
    }
  })
}

export async function getActiveBookingForReplay(
  context: TenantContext,
  input: {
    bookingId: string
    userId: string
  },
) {
  const now = new Date()

  const [row] = await db
    .select({
      id: bookings.id,
      userId: bookings.userId,
      locationId: bookings.locationId,
      status: bookings.status,
      paymentStatus: bookings.paymentStatus,
      startTime: bookings.startTime,
      endTime: bookings.endTime,
      locationName: locations.name,
    })
    .from(bookings)
    .innerJoin(locations, eq(bookings.locationId, locations.id))
    .where(
      and(
        eq(bookings.tenantId, context.tenantId),
        eq(locations.tenantId, context.tenantId),
        eq(bookings.id, input.bookingId),
        eq(bookings.userId, input.userId),
      ),
    )
    .limit(1)

  if (!row) {
    return null
  }

  if (row.status !== "confirmed" || row.paymentStatus !== "paid") {
    return null
  }

  if (row.startTime > now || row.endTime < now) {
    return null
  }

  return row
}

export async function listReplaysForUser(
  context: TenantContext,
  userId: string,
) {
  return db
    .select({
      id: replays.id,
      title: replays.metadata,
      status: replays.status,
      videoUrl: replays.videoUrl,
      mediaAssetId: replays.mediaAssetId,
      requestedAt: replays.requestedAt,
      readyAt: replays.readyAt,
      locationName: locations.name,
      bookingId: replays.bookingId,
    })
    .from(replays)
    .innerJoin(locations, eq(replays.locationId, locations.id))
    .where(
      and(
        eq(replays.tenantId, context.tenantId),
        eq(locations.tenantId, context.tenantId),
        eq(replays.userId, userId),
      ),
    )
    .orderBy(desc(replays.requestedAt))
}

export async function getUserEmail(userId: string) {
  const [row] = await db
    .select({ email: user.email })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1)

  return row?.email ?? null
}
