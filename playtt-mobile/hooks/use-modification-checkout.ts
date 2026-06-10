import { useCallback, useEffect, useRef, useState } from "react"
import { AppState, type AppStateStatus } from "react-native"

import { fetchBookingById, fetchModificationStatus } from "@/lib/booking-api"
import type { ModificationApplyResult } from "@/lib/booking-types"
import { openPaymentCheckout } from "@/lib/payment-browser"
import { toast } from "@/lib/toast"

const FAST_POLL_MS = 1000
const SLOW_POLL_MS = 4000
const FAST_POLL_DURATION_MS = 15000
const MAX_POLL_ATTEMPTS = 20

type UseModificationCheckoutOptions = {
  bookingId: string
  onApplied: () => void | Promise<void>
}

export function useModificationCheckout({
  bookingId,
  onApplied,
}: UseModificationCheckoutOptions) {
  const [isApplying, setIsApplying] = useState(false)
  const [isWaiting, setIsWaiting] = useState(false)
  const [isConfirming, setIsConfirming] = useState(false)
  const modificationIdRef = useRef<string | null>(null)
  const hasAppliedRef = useRef(false)
  const onAppliedRef = useRef(onApplied)

  useEffect(() => {
    onAppliedRef.current = onApplied
  }, [onApplied])

  const completeApplied = useCallback(async () => {
    if (hasAppliedRef.current) {
      return
    }

    hasAppliedRef.current = true
    modificationIdRef.current = null
    setIsWaiting(false)
    setIsConfirming(false)
    await onAppliedRef.current()
  }, [])

  const verifyModification = useCallback(async () => {
    const modificationId = modificationIdRef.current
    if (!modificationId) {
      return false
    }

    const status = await fetchModificationStatus(bookingId, modificationId)

    if (status?.applied) {
      await completeApplied()
      return true
    }

    return false
  }, [bookingId, completeApplied])

  const startWaiting = useCallback((modificationId: string) => {
    hasAppliedRef.current = false
    modificationIdRef.current = modificationId
    setIsWaiting(true)
    setIsConfirming(true)
  }, [])

  useEffect(() => {
    if (!isWaiting) {
      return
    }

    const poll = () => {
      void verifyModification()
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
  }, [isWaiting, verifyModification])

  useEffect(() => {
    if (!isWaiting) {
      return
    }

    function handleAppStateChange(nextState: AppStateStatus) {
      if (nextState === "active") {
        void verifyModification()
      }
    }

    const subscription = AppState.addEventListener("change", handleAppStateChange)
    return () => subscription.remove()
  }, [isWaiting, verifyModification])

  async function pollUntilApplied(modificationId: string) {
    for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt += 1) {
      const status = await fetchModificationStatus(bookingId, modificationId)

      if (status?.applied) {
        await completeApplied()
        return true
      }

      await new Promise((resolve) => setTimeout(resolve, FAST_POLL_MS))
    }

    return false
  }

  async function applyModificationResult(result: ModificationApplyResult) {
    setIsApplying(true)
    hasAppliedRef.current = false

    try {
      if (!result.requiresPayment) {
        await completeApplied()
        return true
      }

      if (!result.authorizationUrl || !result.returnUrl) {
        throw new Error("Payment checkout URL was missing.")
      }

      const browserResult = await openPaymentCheckout(
        result.authorizationUrl,
        result.returnUrl,
      )

      startWaiting(result.modificationId)
      const confirmed = await verifyModification()

      if (!confirmed && browserResult.type === "cancel") {
        const applied = await pollUntilApplied(result.modificationId)
        if (!applied) {
          setIsWaiting(false)
          setIsConfirming(false)
          modificationIdRef.current = null
          toast.info("Payment not completed. Your booking was not changed.")
        }
        return applied
      }

      if (!confirmed) {
        return pollUntilApplied(result.modificationId)
      }

      return true
    } catch (error) {
      toast.apiError(error, "Could not apply changes.")
      setIsWaiting(false)
      setIsConfirming(false)
      modificationIdRef.current = null
      return false
    } finally {
      setIsApplying(false)
    }
  }

  async function handleCheckStatus() {
    if (!modificationIdRef.current) {
      const booking = await fetchBookingById(bookingId)
      if (booking) {
        await onAppliedRef.current()
        return
      }
    }

    setIsConfirming(true)
    const confirmed = await verifyModification()
    if (!confirmed) {
      setIsConfirming(false)
      toast.info("Update not confirmed yet. Try again in a moment.")
    }
  }

  const confirmLabel = isConfirming
    ? "Confirming your update…"
    : isWaiting
      ? "Waiting for payment…"
      : "Confirm changes"

  return {
    isApplying,
    isWaiting,
    isConfirming,
    confirmLabel,
    applyModificationResult,
    handleCheckStatus,
  }
}
