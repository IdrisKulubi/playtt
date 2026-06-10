import { useCallback, useEffect, useMemo, useState } from "react"
import { StyleSheet, Text, View } from "react-native"

import { Button } from "@/components/ui/button"
import {
  PlayTTFontFamilies,
  PlayTTSpacing,
} from "@/constants/playtt-tokens"
import { useProductTheme } from "@/hooks/use-product-theme"
import {
  fetchBookingById,
  fetchBookingPaymentStatus,
  initiateBookingPayment,
} from "@/lib/booking-api"
import type { UserBookingSummary } from "@/lib/booking-types"
import { formatPaymentCountdown } from "@/lib/booking-utils"
import { openPaymentCheckout } from "@/lib/payment-browser"
import { toast } from "@/lib/toast"

type BookingDetailPaymentActionsProps = {
  booking: UserBookingSummary
  onBookingUpdated: (booking: UserBookingSummary) => void
}

const POLL_INTERVAL_MS = 4000

export function BookingDetailPaymentActions({
  booking,
  onBookingUpdated,
}: BookingDetailPaymentActionsProps) {
  const theme = useProductTheme()
  const styles = useMemo(() => createStyles(theme.muted), [theme.muted])

  const [displayText, setDisplayText] = useState<string | null>(null)
  const [isPaying, setIsPaying] = useState(false)
  const [isWaiting, setIsWaiting] = useState(false)
  const [nowMs, setNowMs] = useState(Date.now())

  const needsPayment =
    booking.status === "pending" && booking.paymentStatus === "unpaid"

  useEffect(() => {
    if (!needsPayment) {
      return
    }

    const intervalId = setInterval(() => setNowMs(Date.now()), 1000)
    return () => clearInterval(intervalId)
  }, [needsPayment])

  const refreshBooking = useCallback(async () => {
    await fetchBookingPaymentStatus(booking.id)
    const updated = await fetchBookingById(booking.id)

    if (!updated) {
      return false
    }

    onBookingUpdated(updated)

    if (updated.status === "confirmed" || updated.paymentStatus === "paid") {
      setIsWaiting(false)
      toast.success("Payment received. Booking confirmed.")
      return true
    }

    return false
  }, [booking.id, onBookingUpdated])

  useEffect(() => {
    if (!isWaiting || !needsPayment) {
      return
    }

    const intervalId = setInterval(() => {
      void refreshBooking()
    }, POLL_INTERVAL_MS)

    return () => clearInterval(intervalId)
  }, [isWaiting, needsPayment, refreshBooking])

  async function handlePay() {
    setIsPaying(true)

    try {
      const result = await initiateBookingPayment(booking.id)

      setDisplayText(result.displayText)

      if (!result.authorizationUrl) {
        throw new Error("Payment checkout URL was missing.")
      }

      const browserResult = await openPaymentCheckout(result.authorizationUrl)

      if (browserResult.type === "cancel") {
        toast.info("Checkout closed. You can try again.")
        return
      }

      setIsWaiting(true)
      await refreshBooking()
    } catch (error) {
      toast.apiError(error, "Could not start payment.")
    } finally {
      setIsPaying(false)
    }
  }

  if (!needsPayment) {
    return null
  }

  const countdown = formatPaymentCountdown(booking.expiresAt, nowMs)
  const payLabel = isWaiting ? "Waiting for payment…" : "Pay now"

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Complete payment</Text>

      {countdown ? <Text style={styles.countdown}>{countdown}</Text> : null}

      {displayText ? (
        <Text style={styles.displayText}>{displayText}</Text>
      ) : isWaiting ? (
        <Text style={styles.displayText}>
          Finish payment in the secure checkout page.
        </Text>
      ) : null}

      <Button
        label={payLabel}
        surface="product"
        productTheme={theme}
        onPress={handlePay}
        loading={isPaying}
        disabled={isWaiting}
      />

      {isWaiting ? (
        <Button
          label="I've paid — check status"
          variant="outline"
          surface="product"
          productTheme={theme}
          onPress={() => void refreshBooking()}
        />
      ) : null}
    </View>
  )
}

function createStyles(muted: string) {
  return StyleSheet.create({
    container: {
      gap: PlayTTSpacing.sm,
      marginTop: PlayTTSpacing.md,
      paddingTop: PlayTTSpacing.md,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: muted,
    },
    heading: {
      fontSize: 15,
      fontFamily: PlayTTFontFamilies.semiBold,
    },
    countdown: {
      fontSize: 14,
      fontFamily: PlayTTFontFamilies.semiBold,
    },
    displayText: {
      fontSize: 14,
      fontFamily: PlayTTFontFamilies.regular,
      color: muted,
      lineHeight: 20,
    },
  })
}
