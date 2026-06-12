import { eq } from "drizzle-orm"

import db from "@/db/drizzle"
import { productPayments } from "@/db/schema"
import { kesToPaystackAmount } from "@/server/payments/constants"
import type { PaystackTransactionData } from "@/server/payments/types"
import { REPLAY_PACK_PRICE_KES } from "@/server/replays/constants"
import {
  creditPackPurchase,
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

  if (existingPayment.status === "paid") {
    return { confirmed: true, reason: "already_confirmed" as const }
  }

  if (existingPayment.productType !== "replay_pack") {
    return { confirmed: false, reason: "invalid_product" as const }
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

  await db
    .update(productPayments)
    .set({
      status: "paid",
      paidAt,
      providerEventId: input.providerEventId ?? existingPayment.providerEventId,
      rawPayload: input.transaction as unknown as Record<string, unknown>,
    })
    .where(eq(productPayments.id, existingPayment.id))

  await creditPackPurchase({
    userId: existingPayment.userId,
    productPaymentId: existingPayment.id,
  })

  return { confirmed: true, reason: "confirmed" as const }
}
