import type { Metadata } from "next"

import { PaymentCompleteClient } from "@/components/payments/payment-complete-client"
import { confirmPaymentFromCallback } from "@/server/payments/confirm-from-callback"

export const metadata: Metadata = {
  title: "Payment complete | PlayTT",
}

type PaymentCompletePageProps = {
  searchParams: Promise<{
    bookingId?: string
    client?: string
    reference?: string
    trxref?: string
  }>
}

export default async function PaymentCompletePage({
  searchParams,
}: PaymentCompletePageProps) {
  const params = await searchParams
  const reference = params.reference ?? params.trxref
  const { bookingId } = params
  const client = params.client === "web" ? "web" : "mobile"

  const { confirmed } = await confirmPaymentFromCallback(reference)

  return (
    <PaymentCompleteClient
      bookingId={bookingId}
      client={client}
      confirmed={confirmed}
    />
  )
}
