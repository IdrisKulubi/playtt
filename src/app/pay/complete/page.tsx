import type { Metadata } from "next"

import { PaymentCompleteClient } from "@/components/payments/payment-complete-client"

export const metadata: Metadata = {
  title: "Payment complete | PlayTT",
}

type PaymentCompletePageProps = {
  searchParams: Promise<{ bookingId?: string }>
}

export default async function PaymentCompletePage({
  searchParams,
}: PaymentCompletePageProps) {
  const { bookingId } = await searchParams

  return <PaymentCompleteClient bookingId={bookingId} />
}
