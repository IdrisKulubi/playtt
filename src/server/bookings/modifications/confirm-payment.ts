import { eq } from "drizzle-orm"

import db from "@/db/drizzle"
import { bookingModifications, payments } from "@/db/schema"
import { kesToPaystackAmount } from "@/server/payments/constants"
import {
  applyModificationToBooking,
} from "@/server/bookings/modifications/repository"
import type { ModificationSnapshot } from "@/server/bookings/modifications/types"
import type { PaystackTransactionData } from "@/server/payments/types"

export async function confirmModificationPayment(input: {
  reference: string
  providerEventId?: string | null
  transaction: PaystackTransactionData
}) {
  const [payment] = await db
    .select()
    .from(payments)
    .where(eq(payments.providerReference, input.reference))
    .limit(1)

  if (!payment) {
    return { confirmed: false, reason: "payment_not_found" as const }
  }

  if (payment.status === "paid") {
    return { confirmed: true, reason: "already_confirmed" as const }
  }

  const modificationId =
    typeof input.transaction.metadata === "object" &&
    input.transaction.metadata !== null &&
    "modificationId" in input.transaction.metadata
      ? String(input.transaction.metadata.modificationId)
      : null

  let modification

  if (modificationId) {
    const [row] = await db
      .select()
      .from(bookingModifications)
      .where(eq(bookingModifications.id, modificationId))
      .limit(1)

    modification = row
  } else if (payment.id) {
    const [row] = await db
      .select()
      .from(bookingModifications)
      .where(eq(bookingModifications.paymentId, payment.id))
      .limit(1)

    modification = row
  }

  if (!modification) {
    return { confirmed: false, reason: "modification_not_found" as const }
  }

  if (modification.status === "applied") {
    return { confirmed: true, reason: "already_confirmed" as const }
  }

  const expectedAmount = kesToPaystackAmount(String(modification.deltaAmount))

  if (
    input.transaction.amount !== expectedAmount ||
    input.transaction.currency !== modification.currency
  ) {
    return { confirmed: false, reason: "amount_mismatch" as const }
  }

  if (input.transaction.status !== "success") {
    return { confirmed: false, reason: "not_successful" as const }
  }

  const paidAt = input.transaction.paid_at
    ? new Date(input.transaction.paid_at)
    : new Date()

  await db.transaction(async (tx) => {
    await tx
      .update(payments)
      .set({
        status: "paid",
        paidAt,
        providerEventId: input.providerEventId ?? payment.providerEventId,
        rawPayload: input.transaction as unknown as Record<string, unknown>,
      })
      .where(eq(payments.id, payment.id))
  })

  await applyModificationToBooking({
    modificationId: modification.id,
    afterSnapshot: modification.afterSnapshot as ModificationSnapshot,
  })

  return { confirmed: true, reason: "confirmed" as const }
}
