import { and, eq } from "drizzle-orm"

import db from "@/db/drizzle"
import {
  bookingModifications,
  bookingStatusHistory,
  bookings,
  resources,
} from "@/db/schema"
import type { EditableBookingRow } from "@/server/bookings/modifications/eligibility"
import type { ModificationSnapshot } from "@/server/bookings/modifications/types"

export async function getEditableBookingForUser(input: {
  bookingId: string
  userId: string
}): Promise<EditableBookingRow | null> {
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
    .where(and(eq(bookings.id, input.bookingId), eq(bookings.userId, input.userId)))
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

export async function getModificationById(input: {
  modificationId: string
  userId: string
}) {
  const [row] = await db
    .select()
    .from(bookingModifications)
    .where(
      and(
        eq(bookingModifications.id, input.modificationId),
        eq(bookingModifications.userId, input.userId),
      ),
    )
    .limit(1)

  return row ?? null
}

export async function insertPendingModification(input: {
  bookingId: string
  userId: string
  changeType: string
  beforeSnapshot: ModificationSnapshot
  afterSnapshot: ModificationSnapshot
  deltaAmount: string
  currency: string
  paymentId?: string
}) {
  const [created] = await db
    .insert(bookingModifications)
    .values({
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

export async function attachPaymentToModification(input: {
  modificationId: string
  paymentId: string
}) {
  await db
    .update(bookingModifications)
    .set({ paymentId: input.paymentId })
    .where(eq(bookingModifications.id, input.modificationId))
}

export async function applyModificationToBooking(input: {
  modificationId: string
  afterSnapshot: ModificationSnapshot
}) {
  const after = input.afterSnapshot

  await db.transaction(async (tx) => {
    const [modification] = await tx
      .select()
      .from(bookingModifications)
      .where(eq(bookingModifications.id, input.modificationId))
      .limit(1)

    if (!modification || modification.status === "applied") {
      return
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
      .where(eq(bookings.id, modification.bookingId))

    await tx
      .update(bookingModifications)
      .set({
        status: "applied",
        appliedAt: new Date(),
      })
      .where(eq(bookingModifications.id, input.modificationId))

    await tx.insert(bookingStatusHistory).values({
      bookingId: modification.bookingId,
      fromStatus: "confirmed",
      toStatus: "confirmed",
      reason: "booking_modified",
      metadata: {
        modificationId: input.modificationId,
        source: "booking_modification",
      },
    })
  })
}

export async function getResourceName(resourceId: string) {
  const [row] = await db
    .select({ name: resources.name })
    .from(resources)
    .where(eq(resources.id, resourceId))
    .limit(1)

  return row?.name ?? "Table"
}
