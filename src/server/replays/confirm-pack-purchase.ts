import { kesToPaystackAmount } from "@/server/payments/constants"
import type { PaystackTransactionData } from "@/server/payments/types"
import { REPLAY_PACK_PRICE_KES } from "@/server/replays/constants"
import {
  confirmAndCreditPackPurchase,
  findProductPaymentByReference,
} from "@/server/replays/repository"

export async function confirmReplayPackPurchase(input: {
  reference: string
  providerEventId?: string | null
  transaction: PaystackTransactionData
}) {
  const existingPayment = await findProductPaymentByReference(input.reference)

  if (!existingPayment) {
    return { confirmed: false, reason: "payment_not_found" as const }
  }

  if (existingPayment.productType !== "replay_pack") {
    return { confirmed: false, reason: "invalid_product" as const }
  }

  if (existingPayment.status === "paid") {
    await confirmAndCreditPackPurchase({
      productPaymentId: existingPayment.id,
      paidAt: existingPayment.paidAt ?? new Date(),
      providerEventId: existingPayment.providerEventId,
      rawPayload:
        existingPayment.rawPayload ??
        (input.transaction as unknown as Record<string, unknown>),
    })

    return { confirmed: true, reason: "already_confirmed" as const }
  }

  const expectedAmount = kesToPaystackAmount(REPLAY_PACK_PRICE_KES)

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

  const result = await confirmAndCreditPackPurchase({
    productPaymentId: existingPayment.id,
    paidAt,
    providerEventId: input.providerEventId,
    rawPayload: input.transaction as unknown as Record<string, unknown>,
  })

  if (result === "payment_not_found") {
    return { confirmed: false, reason: "payment_not_found" as const }
  }

  if (result === "already_credited") {
    return { confirmed: true, reason: "already_confirmed" as const }
  }

  return { confirmed: true, reason: "confirmed" as const }
}
