import { COACH_MONTHLY_PRICE_KES } from "@/server/coach/constants"
import {
  confirmCoachSubscriptionActivation,
  findProductPaymentByReference,
} from "@/server/coach/repository"
import { kesToPaystackAmount } from "@/server/payments/constants"
import type { PaystackTransactionData } from "@/server/payments/types"

export async function confirmCoachSubscriptionPurchase(input: {
  reference: string
  providerEventId?: string | null
  transaction: PaystackTransactionData
}) {
  const existingPayment = await findProductPaymentByReference(input.reference)

  if (!existingPayment) {
    return { confirmed: false, reason: "payment_not_found" as const }
  }

  if (existingPayment.productType !== "coach_subscription") {
    return { confirmed: false, reason: "invalid_product" as const }
  }

  if (existingPayment.status !== "paid") {
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
  }

  const paidAt =
    existingPayment.paidAt ??
    (input.transaction.paid_at
      ? new Date(input.transaction.paid_at)
      : new Date())

  const transition = await confirmCoachSubscriptionActivation({
    paymentId: existingPayment.id,
    userId: existingPayment.userId,
    paidAt,
    providerEventId: input.providerEventId ?? existingPayment.providerEventId,
    rawPayload: input.transaction as unknown as Record<string, unknown>,
  })

  if (transition === "already_confirmed") {
    return { confirmed: true, reason: "already_confirmed" as const }
  }

  if (transition === "state_changed") {
    return { confirmed: false, reason: "payment_state_changed" as const }
  }

  return { confirmed: true, reason: "confirmed" as const }
}
