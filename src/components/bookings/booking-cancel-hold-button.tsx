"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { canCancelBooking } from "@/components/bookings/booking-utils"
import { Button } from "@/components/ui/button"
import type { UserBookingSummary } from "@/server/bookings/types"

type BookingCancelHoldButtonProps = {
  booking: UserBookingSummary
}

export function BookingCancelHoldButton({ booking }: BookingCancelHoldButtonProps) {
  const router = useRouter()
  const [isCancelling, setIsCancelling] = useState(false)

  if (!canCancelBooking(booking)) {
    return null
  }

  async function handleCancel() {
    setIsCancelling(true)

    try {
      const response = await fetch(`/api/bookings/${booking.id}/cancel`, {
        method: "POST",
      })
      const payload = (await response.json().catch(() => null)) as {
        message?: string
      } | null

      if (!response.ok) {
        throw new Error(payload?.message ?? "Could not release this booking.")
      }

      toast.success("Booking hold released.")
      router.refresh()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not release this booking.",
      )
    } finally {
      setIsCancelling(false)
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      data-testid="release-booking-hold"
      disabled={isCancelling}
      onClick={() => void handleCancel()}
    >
      {isCancelling ? "Releasing hold..." : "Release hold"}
    </Button>
  )
}
