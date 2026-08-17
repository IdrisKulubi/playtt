import { and, eq, isNull, or } from "drizzle-orm"

import db from "@/db/drizzle"
import {
  bookingCreditBalances,
  bookingCreditLedger,
  bookingModifications,
  bookingStatusHistory,
  bookings,
  resources,
} from "@/db/schema"
import type { EditableBookingRow } from "@/server/bookings/modifications/eligibility"
import type { ModificationSnapshot } from "@/server/bookings/modifications/types"
import type { TenantContext } from "@/server/tenancy/types"

type BookingTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0]

export type ApplyModificationResult =
  | "applied"
  | "already_applied"
  | "not_found"
  | "not_pending"
  | "payment_mismatch"

export async function getEditableBookingForUser(
  context: TenantContext,
  input: {
    bookingId: string
    userId: string
  },
): Promise<EditableBookingRow | null> {
  const [row] = await db
    .select({
      id: bookings.id,
      userId: bookings.userId,
      status: bookings.status,
      paymentStatus: bookings.paymentStatus,
      startTime: bookings.startTime,
      endTime: bookings.endTime,
      durationMinutes: bookings.durationMinutes,
      groupSize: bookings.groupSize,
      locationId: bookings.locationId,
      resourceId: bookings.resourceId,
      currency: bookings.currency,
      subtotalAmount: bookings.subtotalAmount,
      discountAmount: bookings.discountAmount,
      totalAmount: bookings.totalAmount,
      notes: bookings.notes,
      pricingRuleSnapshot: bookings.pricingRuleSnapshot,
    })
    .from(bookings)
    .where(
      and(
        eq(bookings.tenantId, context.tenantId),
        eq(bookings.id, input.bookingId),
        eq(bookings.userId, input.userId),
      ),
    )
    .limit(1)

  if (!row) {
    return null
  }

  return {
    ...row,
    subtotalAmount: String(row.subtotalAmount),
    discountAmount: String(row.discountAmount),
    totalAmount: String(row.totalAmount),
    pricingRuleSnapshot: row.pricingRuleSnapshot ?? null,
  }
}

export async function getModificationById(
  context: TenantContext,
  input: {
    modificationId: string
    userId: string
  },
) {
  const [row] = await db
    .select()
    .from(bookingModifications)
    .where(
      and(
        eq(bookingModifications.tenantId, context.tenantId),
        eq(bookingModifications.id, input.modificationId),
        eq(bookingModifications.userId, input.userId),
      ),
    )
    .limit(1)

  return row ?? null
}

export async function insertPendingModification(
  context: TenantContext,
  input: {
    bookingId: string
    userId: string
    changeType: string
    beforeSnapshot: ModificationSnapshot
    afterSnapshot: ModificationSnapshot
    deltaAmount: string
    currency: string
    paymentId?: string
  },
) {
  const [created] = await db
    .insert(bookingModifications)
    .values({
      tenantId: context.tenantId,
      bookingId: input.bookingId,
      userId: input.userId,
      status: "pending_payment",
      changeType: input.changeType,
      beforeSnapshot: input.beforeSnapshot,
      afterSnapshot: input.afterSnapshot,
      deltaAmount: input.deltaAmount,
      currency: input.currency,
      paymentId: input.paymentId ?? null,
      appliedAt: null,
    })
    .returning()

  return created
}

export async function attachPaymentToModification(
  context: TenantContext,
  input: {
    modificationId: string
    paymentId: string
  },
) {
  const [attached] = await db
    .update(bookingModifications)
    .set({ paymentId: input.paymentId })
    .where(
      and(
        eq(bookingModifications.tenantId, context.tenantId),
        eq(bookingModifications.id, input.modificationId),
        eq(bookingModifications.status, "pending_payment"),
        or(
          isNull(bookingModifications.paymentId),
          eq(bookingModifications.paymentId, input.paymentId),
        ),
      ),
    )
    .returning({ id: bookingModifications.id })

  return Boolean(attached)
}

export async function applyModificationToBooking(
  context: TenantContext,
  input: {
    modificationId: string
    afterSnapshot: ModificationSnapshot
    creditAmount?: string
  },
) {
  return db.transaction((tx) =>
    applyModificationWithinTransaction(tx, context, input),
  )
}

export async function applyModificationWithinTransaction(
  tx: BookingTransaction,
  context: TenantContext,
  input: {
    modificationId: string
    creditAmount?: string
    paymentId?: string
  },
): Promise<ApplyModificationResult> {
  const [modification] = await tx
    .select()
    .from(bookingModifications)
    .where(
      and(
        eq(bookingModifications.tenantId, context.tenantId),
        eq(bookingModifications.id, input.modificationId),
      ),
    )
    .for("update")
    .limit(1)

  if (!modification) {
    return "not_found"
  }

  if (
    input.paymentId &&
    modification.paymentId !== null &&
    modification.paymentId !== input.paymentId
  ) {
    return "payment_mismatch"
  }

  if (modification.status === "applied") {
    if (input.paymentId && modification.paymentId !== input.paymentId) {
      return "payment_mismatch"
    }
    return "already_applied"
  }

  if (modification.status !== "pending_payment") {
    return "not_pending"
  }

  const after = modification.afterSnapshot as ModificationSnapshot
  const creditAmount = Number(input.creditAmount ?? "0")
  const appliedAt = new Date()
  const paymentCondition = input.paymentId
    ? modification.paymentId === null
      ? isNull(bookingModifications.paymentId)
      : eq(bookingModifications.paymentId, input.paymentId)
    : undefined

  const [claimed] = await tx
    .update(bookingModifications)
    .set({
      status: "applied",
      appliedAt,
      paymentId: input.paymentId ?? modification.paymentId,
    })
    .where(
      and(
        eq(bookingModifications.tenantId, context.tenantId),
        eq(bookingModifications.id, input.modificationId),
        eq(bookingModifications.status, "pending_payment"),
        paymentCondition,
      ),
    )
    .returning({ id: bookingModifications.id })

  if (!claimed) {
    return "not_pending"
  }

  await tx
    .update(bookings)
    .set({
      resourceId: after.resourceId,
      startTime: new Date(after.startTime),
      endTime: new Date(after.endTime),
      durationMinutes: after.durationMinutes,
      groupSize: after.groupSize,
      subtotalAmount: after.subtotalAmount,
      discountAmount: after.discountAmount,
      totalAmount: after.totalAmount,
      pricingRuleSnapshot: after.pricingRuleSnapshot,
      notes: after.notes,
    })
    .where(
      and(
        eq(bookings.tenantId, context.tenantId),
        eq(bookings.id, modification.bookingId),
      ),
    )

  await tx.insert(bookingStatusHistory).values({
    tenantId: context.tenantId,
    bookingId: modification.bookingId,
    fromStatus: "confirmed",
    toStatus: "confirmed",
    reason: "booking_modified",
    metadata: {
      modificationId: input.modificationId,
      source: "booking_modification",
    },
  })

  if (creditAmount > 0) {
    await tx
      .insert(bookingCreditBalances)
      .values({
        tenantId: context.tenantId,
        userId: modification.userId,
        balanceAmount: "0",
        currency: modification.currency,
      })
      .onConflictDoNothing()

    const [balanceRow] = await tx
      .select()
      .from(bookingCreditBalances)
      .where(
        and(
          eq(bookingCreditBalances.tenantId, context.tenantId),
          eq(bookingCreditBalances.userId, modification.userId),
        ),
      )
      .for("update")
      .limit(1)

    const currentBalance = Number(balanceRow?.balanceAmount ?? "0")
    const nextBalance = currentBalance + creditAmount

    await tx
      .update(bookingCreditBalances)
      .set({
        balanceAmount: nextBalance.toFixed(2),
        currency: modification.currency,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(bookingCreditBalances.tenantId, context.tenantId),
          eq(bookingCreditBalances.userId, modification.userId),
        ),
      )

    await tx.insert(bookingCreditLedger).values({
      tenantId: context.tenantId,
      userId: modification.userId,
      bookingId: modification.bookingId,
      bookingModificationId: modification.id,
      deltaAmount: creditAmount.toFixed(2),
      currency: modification.currency,
      reason: "booking_reduction",
    })
  }

  return "applied"
}

export async function getResourceName(
  context: TenantContext,
  resourceId: string,
) {
  const [row] = await db
    .select({ name: resources.name })
    .from(resources)
    .where(
      and(eq(resources.tenantId, context.tenantId), eq(resources.id, resourceId)),
    )
    .limit(1)

  return row?.name ?? "Table"
}
