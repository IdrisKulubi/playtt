"use client"

import { useState } from "react"
import { ArrowRightIcon } from "@phosphor-icons/react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import type { InitiatePaymentResult } from "@/server/payments/types"

type PaymentResponse = {
  data?: InitiatePaymentResult
  message?: string
}

export function BookingPaymentButton({ bookingId }: { bookingId: string }) {
  const [isRedirecting, setIsRedirecting] = useState(false)

  async function handlePayment() {
    setIsRedirecting(true)

    try {
      const response = await fetch(`/api/bookings/${bookingId}/pay`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ client: "web" }),
      })
      const result = (await response.json()) as PaymentResponse

      if (!response.ok || !result.data?.authorizationUrl) {
        throw new Error(result.message ?? "Could not start payment.")
      }

      toast.success("Opening secure checkout.")
      window.location.href = result.data.authorizationUrl
    } catch (error) {
      setIsRedirecting(false)
      toast.error(
        error instanceof Error ? error.message : "Could not start payment.",
      )
    }
  }

  return (
    <Button
      size="sm"
      className="w-full md:w-auto"
      disabled={isRedirecting}
      onClick={handlePayment}
    >
      {isRedirecting ? "Opening Paystack..." : "Finish payment"}
      <ArrowRightIcon className="size-4" />
    </Button>
  )
}
