import { and, eq } from "drizzle-orm"

import db from "@/db/drizzle"
import { bookingModifications, payments } from "@/db/schema"
import { kesToPaystackAmount } from "@/server/payments/constants"
import { applyModificationWithinTransaction } from "@/server/bookings/modifications/repository"
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

  if (modification.paymentId && modification.paymentId !== payment.id) {
    return { confirmed: false, reason: "modification_not_found" as const }
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

  const result = await db.transaction(async (tx) => {
    const [lockedPayment] = await tx
      .select()
      .from(payments)
      .where(eq(payments.id, payment.id))
      .for("update")
      .limit(1)

    if (!lockedPayment) {
      return "payment_not_found" as const
    }

    const applicationResult = await applyModificationWithinTransaction(tx, {
      modificationId: modification.id,
      paymentId: lockedPayment.id,
    })

    if (
      applicationResult === "not_found" ||
      applicationResult === "payment_mismatch"
    ) {
      return applicationResult
    }

    if (lockedPayment.status !== "paid") {
      const [updatedPayment] = await tx
        .update(payments)
        .set({
          status: "paid",
          paidAt,
          providerEventId:
            input.providerEventId ?? lockedPayment.providerEventId,
          rawPayload: input.transaction as unknown as Record<string, unknown>,
        })
        .where(
          and(
            eq(payments.id, lockedPayment.id),
            eq(payments.status, lockedPayment.status)
          )
        )
        .returning({ id: payments.id })

      if (!updatedPayment) {
        throw new Error("Payment status changed while confirming modification.")
      }
    }

    if (applicationResult === "not_pending") {
      return "paid_not_applied" as const
    }

    return applicationResult
  })

  if (result === "payment_not_found") {
    return { confirmed: false, reason: "payment_not_found" as const }
  }

  if (result === "not_found") {
    return { confirmed: false, reason: "modification_not_found" as const }
  }

  if (result === "payment_mismatch") {
    return { confirmed: false, reason: "modification_not_found" as const }
  }

  if (result === "paid_not_applied") {
    return {
      confirmed: false,
      reason: "payment_recorded_modification_not_applied" as const,
    }
  }

  if (result === "already_applied") {
    return { confirmed: true, reason: "already_confirmed" as const }
  }

  return { confirmed: true, reason: "confirmed" as const }
}
