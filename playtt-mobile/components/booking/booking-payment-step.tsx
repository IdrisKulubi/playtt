import { useEffect, useMemo, useState } from "react"
import { ActivityIndicator, StyleSheet, Text, View } from "react-native"

import { createBookingFlowStyles } from "@/components/booking/booking-theme"
import { Button } from "@/components/ui/button"
import {
  PlayTTColors,
  PlayTTFontFamilies,
  PlayTTSpacing,
} from "@/constants/playtt-tokens"
import { usePaymentCheckout } from "@/hooks/use-payment-checkout"
import { useProductTheme } from "@/hooks/use-product-theme"
import type { CreateBookingResult, LocationSummary } from "@/lib/booking-types"
import {
  formatKes,
  formatPaymentCountdown,
  formatTimeRange,
} from "@/lib/booking-utils"

type BookingPaymentStepProps = {
  confirmation: CreateBookingResult
  location: LocationSummary | null
  startTimeIso: string
  endTimeIso: string
  onConfirmed: () => void
  onExpired: () => void
}

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

  const [nowMs, setNowMs] = useState(Date.now())

  const {
    displayText,
    isPaying,
    isWaiting,
    isConfirming,
    payLabel,
    handlePay,
    handleCheckStatus,
  } = usePaymentCheckout({
    bookingId: confirmation.bookingId,
    onConfirmed,
  })

  useEffect(() => {
    const intervalId = setInterval(() => setNowMs(Date.now()), 1000)
    return () => clearInterval(intervalId)
  }, [])

  const countdown = formatPaymentCountdown(confirmation.expiresAt, nowMs)

  useEffect(() => {
    if (
      confirmation.expiresAt &&
      new Date(confirmation.expiresAt).getTime() <= nowMs
    ) {
      onExpired()
    }
  }, [confirmation.expiresAt, nowMs, onExpired])

  return (
    <View style={styles.section}>
      {isConfirming ? (
        <>
          <View style={localStyles.confirmingRow}>
            <ActivityIndicator color={PlayTTColors.primary} />
            <Text style={styles.confirmedTitle}>Confirming payment…</Text>
          </View>
          <Text style={styles.confirmedBody}>
            This usually takes a few seconds.
          </Text>
        </>
      ) : (
        <>
          <Text style={styles.confirmedTitle}>Complete payment</Text>
          <Text style={styles.confirmedBody}>
            Complete payment to confirm your booking.
          </Text>
        </>
      )}

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

      {displayText && !isConfirming ? (
        <Text style={localStyles.displayText}>{displayText}</Text>
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

function createLocalStyles(foreground: string, muted: string) {
  return StyleSheet.create({
    confirmingRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: PlayTTSpacing.sm,
    },
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
