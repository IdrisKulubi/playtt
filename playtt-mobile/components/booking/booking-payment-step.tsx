import { useCallback, useEffect, useMemo, useState } from "react"
import { StyleSheet, Text, View } from "react-native"

import { createBookingFlowStyles } from "@/components/booking/booking-theme"
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
import type { CreateBookingResult, LocationSummary } from "@/lib/booking-types"
import {
  formatKes,
  formatPaymentCountdown,
  formatTimeRange,
} from "@/lib/booking-utils"
import { openPaymentCheckout } from "@/lib/payment-browser"
import { toast } from "@/lib/toast"

type BookingPaymentStepProps = {
  confirmation: CreateBookingResult
  location: LocationSummary | null
  startTimeIso: string
  endTimeIso: string
  onConfirmed: () => void
  onExpired: () => void
}

const POLL_INTERVAL_MS = 4000

export function BookingPaymentStep({
  confirmation,
  location,
  startTimeIso,
  endTimeIso,
  onConfirmed,
  onExpired,
}: BookingPaymentStepProps) {
  const theme = useProductTheme()
  const styles = useMemo(() => createBookingFlowStyles(theme), [theme])
  const localStyles = useMemo(() => createLocalStyles(theme.foreground, theme.muted), [theme])

  const [displayText, setDisplayText] = useState<string | null>(null)
  const [isPaying, setIsPaying] = useState(false)
  const [isWaiting, setIsWaiting] = useState(false)
  const [nowMs, setNowMs] = useState(Date.now())

  useEffect(() => {
    const intervalId = setInterval(() => setNowMs(Date.now()), 1000)
    return () => clearInterval(intervalId)
  }, [])

  const countdown = formatPaymentCountdown(confirmation.expiresAt, nowMs)

  const pollPaymentStatus = useCallback(async () => {
    const booking = await fetchBookingById(confirmation.bookingId)

    if (booking?.status === "confirmed" || booking?.paymentStatus === "paid") {
      onConfirmed()
      return true
    }

    if (booking?.status === "expired") {
      onExpired()
      return true
    }

    await fetchBookingPaymentStatus(confirmation.bookingId)
    return false
  }, [confirmation.bookingId, onConfirmed, onExpired])

  useEffect(() => {
    if (!isWaiting) {
      return
    }

    const intervalId = setInterval(() => {
      void pollPaymentStatus()
    }, POLL_INTERVAL_MS)

    return () => clearInterval(intervalId)
  }, [isWaiting, pollPaymentStatus])

  useEffect(() => {
    if (
      confirmation.expiresAt &&
      new Date(confirmation.expiresAt).getTime() <= nowMs
    ) {
      onExpired()
    }
  }, [confirmation.expiresAt, nowMs, onExpired])

  async function handlePay() {
    setIsPaying(true)

    try {
      const result = await initiateBookingPayment(confirmation.bookingId)

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
      await pollPaymentStatus()
    } catch (error) {
      toast.apiError(error, "Could not start payment.")
    } finally {
      setIsPaying(false)
    }
  }

  const payLabel = isWaiting ? "Waiting for payment…" : "Pay now"

  return (
    <View style={styles.section}>
      <Text style={styles.confirmedTitle}>Complete payment</Text>
      <Text style={styles.confirmedBody}>
        Complete payment to confirm your booking.
      </Text>

      {location ? (
        <>
          <Text style={styles.confirmedVenue}>{location.name}</Text>
          <Text style={styles.confirmedMeta}>
            {formatTimeRange(startTimeIso, endTimeIso)}
          </Text>
          <Text style={styles.confirmedMeta}>
            {formatKes(confirmation.totalAmount, confirmation.currency)}
          </Text>
        </>
      ) : null}

      {countdown ? <Text style={localStyles.countdown}>{countdown}</Text> : null}

      {displayText ? (
        <Text style={localStyles.displayText}>{displayText}</Text>
      ) : isWaiting ? (
        <Text style={localStyles.displayText}>
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
          onPress={() => void pollPaymentStatus()}
        />
      ) : null}
    </View>
  )
}

function createLocalStyles(foreground: string, muted: string) {
  return StyleSheet.create({
    countdown: {
      marginTop: PlayTTSpacing.sm,
      fontSize: 14,
      fontFamily: PlayTTFontFamilies.semiBold,
      color: foreground,
    },
    displayText: {
      marginTop: PlayTTSpacing.sm,
      fontSize: 14,
      fontFamily: PlayTTFontFamilies.regular,
      color: muted,
      lineHeight: 20,
    },
  })
}
