import { useCallback, useEffect, useRef, useState } from "react"
import { AppState, type AppStateStatus } from "react-native"

import {
  fetchBookingById,
  fetchBookingPaymentStatus,
  initiateBookingPayment,
} from "@/lib/booking-api"
import type { PaymentStatusResult } from "@/lib/booking-types"
import {
  getPaymentReturnUrlFallback,
  openPaymentCheckout,
} from "@/lib/payment-browser"
import { toast } from "@/lib/toast"

const FAST_POLL_MS = 1000
const SLOW_POLL_MS = 4000
const FAST_POLL_DURATION_MS = 15000

function isPaymentConfirmed(
  paymentStatus: PaymentStatusResult | null,
  bookingStatus?: string | null,
  bookingPaymentStatus?: string | null,
) {
  if (
    paymentStatus?.bookingStatus === "confirmed" ||
    paymentStatus?.paymentStatus === "paid"
  ) {
    return true
  }

  return bookingStatus === "confirmed" || bookingPaymentStatus === "paid"
}

type UsePaymentCheckoutOptions = {
  bookingId: string
  onConfirmed: () => void | Promise<void>
}

export function usePaymentCheckout({
  bookingId,
  onConfirmed,
}: UsePaymentCheckoutOptions) {
  const [displayText, setDisplayText] = useState<string | null>(null)
  const [isPaying, setIsPaying] = useState(false)
  const [isWaiting, setIsWaiting] = useState(false)
  const [isConfirming, setIsConfirming] = useState(false)
  const onConfirmedRef = useRef(onConfirmed)

  useEffect(() => {
    onConfirmedRef.current = onConfirmed
  }, [onConfirmed])

  const verifyPayment = useCallback(async () => {
    const paymentStatus = await fetchBookingPaymentStatus(bookingId)

    if (isPaymentConfirmed(paymentStatus)) {
      await onConfirmedRef.current()
      setIsWaiting(false)
      setIsConfirming(false)
      return true
    }

    const booking = await fetchBookingById(bookingId)

    if (isPaymentConfirmed(null, booking?.status, booking?.paymentStatus)) {
      await onConfirmedRef.current()
      setIsWaiting(false)
      setIsConfirming(false)
      return true
    }

    return false
  }, [bookingId])

  const startWaiting = useCallback(() => {
    setIsWaiting(true)
    setIsConfirming(true)
  }, [])

  useEffect(() => {
    if (!isWaiting) {
      return
    }

    const poll = () => {
      void verifyPayment()
    }

    poll()

    let intervalId = setInterval(poll, FAST_POLL_MS)

    const slowPollTimeoutId = setTimeout(() => {
      clearInterval(intervalId)
      intervalId = setInterval(poll, SLOW_POLL_MS)
    }, FAST_POLL_DURATION_MS)

    return () => {
      clearInterval(intervalId)
      clearTimeout(slowPollTimeoutId)
    }
  }, [isWaiting, verifyPayment])

  useEffect(() => {
    if (!isWaiting) {
      return
    }

    function handleAppStateChange(nextState: AppStateStatus) {
      if (nextState === "active") {
        void verifyPayment()
      }
    }

    const subscription = AppState.addEventListener("change", handleAppStateChange)
    return () => subscription.remove()
  }, [isWaiting, verifyPayment])

  async function handlePay() {
    setIsPaying(true)

    try {
      const result = await initiateBookingPayment(bookingId)

      setDisplayText(result.displayText)

      if (!result.authorizationUrl) {
        throw new Error("Payment checkout URL was missing.")
      }

      const browserResult = await openPaymentCheckout(
        result.authorizationUrl,
        result.returnUrl ?? getPaymentReturnUrlFallback(),
      )

      startWaiting()
      const confirmed = await verifyPayment()

      if (!confirmed && browserResult.type === "cancel") {
        setIsWaiting(false)
        setIsConfirming(false)
        toast.info("Checkout closed. You can try again.")
        return
      }
    } catch (error) {
      toast.apiError(error, "Could not start payment.")
      setIsWaiting(false)
      setIsConfirming(false)
    } finally {
      setIsPaying(false)
    }
  }

  async function handleCheckStatus() {
    setIsConfirming(true)
    const confirmed = await verifyPayment()
    if (!confirmed) {
      setIsConfirming(false)
      toast.info("Payment not confirmed yet. Try again in a moment.")
    }
  }

  const payLabel = isConfirming
    ? "Confirming payment…"
    : isWaiting
      ? "Waiting for payment…"
      : "Pay now"

  return {
    displayText,
    isPaying,
    isWaiting,
    isConfirming,
    payLabel,
    handlePay,
    handleCheckStatus,
  }
}
