import { useCallback, useEffect, useRef, useState } from "react"
import { AppState, type AppStateStatus } from "react-native"

import type { PurchaseInitResult } from "@/lib/coach-types"
import {
  getPaymentReturnUrlFallback,
  openPaymentCheckout,
} from "@/lib/payment-browser"
import { toast } from "@/lib/toast"

type UseProductPaymentCheckoutOptions = {
  initiate: () => Promise<PurchaseInitResult>
  onConfirmed: () => void | Promise<void>
}

export function useProductPaymentCheckout({
  initiate,
  onConfirmed,
}: UseProductPaymentCheckoutOptions) {
  const [displayText, setDisplayText] = useState<string | null>(null)
  const [isPaying, setIsPaying] = useState(false)
  const [isWaiting, setIsWaiting] = useState(false)
  const onConfirmedRef = useRef(onConfirmed)
  const initiateRef = useRef(initiate)

  useEffect(() => {
    onConfirmedRef.current = onConfirmed
    initiateRef.current = initiate
  }, [onConfirmed, initiate])

  const handlePay = useCallback(async () => {
    setIsPaying(true)

    try {
      const result = await initiateRef.current()
      setDisplayText(result.displayText)

      if (!result.authorizationUrl) {
        throw new Error("Payment checkout URL was missing.")
      }

      const browserResult = await openPaymentCheckout(
        result.authorizationUrl,
        result.returnUrl ?? getPaymentReturnUrlFallback(),
      )

      setIsWaiting(true)
      await onConfirmedRef.current()
      setIsWaiting(false)

      if (browserResult.type === "cancel") {
        toast.info("Checkout closed. You can try again.")
      }
    } catch (error) {
      toast.apiError(error, "Could not start payment.")
      setIsWaiting(false)
    } finally {
      setIsPaying(false)
    }
  }, [])

  useEffect(() => {
    if (!isWaiting) {
      return
    }

    function handleAppStateChange(nextState: AppStateStatus) {
      if (nextState === "active") {
        void onConfirmedRef.current()
        setIsWaiting(false)
      }
    }

    const subscription = AppState.addEventListener("change", handleAppStateChange)
    return () => subscription.remove()
  }, [isWaiting])

  const payLabel = isWaiting ? "Waiting for payment…" : "Pay now"

  return {
    displayText,
    isPaying,
    isWaiting,
    payLabel,
    handlePay,
  }
}
