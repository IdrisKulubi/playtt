import { confirmModificationPayment } from "@/server/bookings/modifications/confirm-payment"
import { confirmBookingPayment } from "@/server/payments/confirm-booking"
import { verifyPaystackTransaction } from "@/server/payments/paystack-client"

export type ConfirmFromCallbackResult = {
  confirmed: boolean
  reason: string
}

export async function confirmPaymentFromCallback(
  reference: string | null | undefined,
): Promise<ConfirmFromCallbackResult> {
  if (!reference?.trim()) {
    return { confirmed: false, reason: "missing_reference" }
  }

  try {
    const transaction = await verifyPaystackTransaction(reference.trim())

    if (transaction.status !== "success") {
      return { confirmed: false, reason: "not_successful" }
    }

    const metadata =
      typeof transaction.metadata === "object" && transaction.metadata !== null
        ? transaction.metadata
        : null

    const isModification =
      metadata &&
      "paymentType" in metadata &&
      metadata.paymentType === "modification"

    const result = isModification
      ? await confirmModificationPayment({
          reference: reference.trim(),
          providerEventId: String(transaction.id),
          transaction,
        })
      : await confirmBookingPayment({
          reference: reference.trim(),
          providerEventId: String(transaction.id),
          transaction,
          source: "verify",
        })

    if (result.confirmed) {
      return { confirmed: true, reason: result.reason }
    }

    if (!isModification) {
      const modificationResult = await confirmModificationPayment({
        reference: reference.trim(),
        providerEventId: String(transaction.id),
        transaction,
      })

      if (modificationResult.confirmed) {
        return { confirmed: true, reason: modificationResult.reason }
      }
    }

    return { confirmed: false, reason: result.reason }
  } catch (error) {
    console.error("[PAYMENT CALLBACK] Verify failed:", error)
    return { confirmed: false, reason: "verify_failed" }
  }
}
