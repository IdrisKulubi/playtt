import { useCallback, useEffect, useMemo, useState } from "react"
import { ActivityIndicator, StyleSheet, Text, View } from "react-native"

import { Button } from "@/components/ui/button"
import {
  PlayTTColors,
  PlayTTFontFamilies,
  PlayTTSpacing,
} from "@/constants/playtt-tokens"
import { usePaymentCheckout } from "@/hooks/use-payment-checkout"
import { useProductTheme } from "@/hooks/use-product-theme"
import { fetchBookingById } from "@/lib/booking-api"
import type { UserBookingSummary } from "@/lib/booking-types"
import { formatPaymentCountdown } from "@/lib/booking-utils"
import { toast } from "@/lib/toast"

type BookingDetailPaymentActionsProps = {
  booking: UserBookingSummary
  onBookingUpdated: (booking: UserBookingSummary) => void
}

export function BookingDetailPaymentActions({
  booking,
  onBookingUpdated,
}: BookingDetailPaymentActionsProps) {
  const theme = useProductTheme()
  const styles = useMemo(() => createStyles(theme.muted), [theme.muted])

  const [nowMs, setNowMs] = useState(Date.now())

  const needsPayment =
    booking.status === "pending" && booking.paymentStatus === "unpaid"

  const handleConfirmed = useCallback(async () => {
    const updated = await fetchBookingById(booking.id)
    if (updated) {
      onBookingUpdated(updated)
    }
    toast.success("Payment received. Booking confirmed.")
  }, [booking.id, onBookingUpdated])

  const {
    displayText,
    isPaying,
    isWaiting,
    isConfirming,
    payLabel,
    handlePay,
    handleCheckStatus,
  } = usePaymentCheckout({
    bookingId: booking.id,
    onConfirmed: handleConfirmed,
  })

  useEffect(() => {
    if (!needsPayment) {
      return
    }

    const intervalId = setInterval(() => setNowMs(Date.now()), 1000)
    return () => clearInterval(intervalId)
  }, [needsPayment])

  if (!needsPayment) {
    return null
  }

  const countdown = formatPaymentCountdown(booking.expiresAt, nowMs)

  return (
    <View style={styles.container}>
      {isConfirming ? (
        <View style={styles.confirmingRow}>
          <ActivityIndicator color={PlayTTColors.primary} size="small" />
          <Text style={styles.heading}>Confirming payment…</Text>
        </View>
      ) : (
        <Text style={styles.heading}>Complete payment</Text>
      )}

      {countdown ? <Text style={styles.countdown}>{countdown}</Text> : null}

      {displayText && !isConfirming ? (
        <Text style={styles.displayText}>{displayText}</Text>
      ) : null}

      {!isConfirming ? (
        <Button
          label={payLabel}
          surface="product"
          productTheme={theme}
          onPress={handlePay}
          loading={isPaying}
          disabled={isWaiting}
        />
      ) : null}

      {isWaiting && !isConfirming ? (
        <Button
          label="I've paid — check status"
          variant="outline"
          surface="product"
          productTheme={theme}
          onPress={() => void handleCheckStatus()}
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
    confirmingRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: PlayTTSpacing.sm,
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
