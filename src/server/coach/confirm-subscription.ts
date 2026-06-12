import { eq } from "drizzle-orm"

import db from "@/db/drizzle"
import { productPayments } from "@/db/schema"
import { activateCoachSubscription } from "@/server/coach/repository"
import { COACH_MONTHLY_PRICE_KES } from "@/server/coach/constants"
import { kesToPaystackAmount } from "@/server/payments/constants"
import type { PaystackTransactionData } from "@/server/payments/types"
import { findProductPaymentByReference } from "@/server/coach/repository"

export async function confirmCoachSubscriptionPurchase(input: {
  reference: string
  providerEventId?: string | null
  transaction: PaystackTransactionData
}) {
  const existingPayment = await findProductPaymentByReference(input.reference)

  if (!existingPayment) {
    return { confirmed: false, reason: "payment_not_found" as const }
  }

  if (existingPayment.status === "paid") {
    return { confirmed: true, reason: "already_confirmed" as const }
  }

  if (existingPayment.productType !== "coach_subscription") {
    return { confirmed: false, reason: "invalid_product" as const }
  }

  const expectedAmount = kesToPaystackAmount(COACH_MONTHLY_PRICE_KES)

  if (
    input.transaction.amount !== expectedAmount ||
    input.transaction.currency !== existingPayment.currency
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
      .update(productPayments)
      .set({
        status: "paid",
        paidAt,
        providerEventId: input.providerEventId ?? existingPayment.providerEventId,
        rawPayload: input.transaction as unknown as Record<string, unknown>,
      })
      .where(eq(productPayments.id, existingPayment.id))
  })

  await activateCoachSubscription({
    userId: existingPayment.userId,
    productPaymentId: existingPayment.id,
  })

  return { confirmed: true, reason: "confirmed" as const }
}
