import { useCallback, useEffect, useState } from "react"
import { ActivityIndicator, StyleSheet, View } from "react-native"

import { Button } from "@/components/kit/button"
import { Card } from "@/components/kit/card"
import { AppText } from "@/components/ui/app-text"
import { PlayTTSpacing } from "@/constants/playtt-tokens"
import { useAppTheme } from "@/hooks/use-app-theme"
import { usePaymentCheckout } from "@/hooks/use-payment-checkout"
import { fetchBookingById } from "@/lib/booking-api"
import type { UserBookingSummary } from "@/lib/booking-types"
import { formatPaymentCountdown, needsBookingPayment } from "@/lib/booking-utils"
import { haptics } from "@/lib/haptics"
import { toast } from "@/lib/toast"

/** Under this, the countdown turns orange so nobody is caught out. */
const HOLD_WARNING_MS = 2 * 60 * 1000

type BookingDetailPaymentActionsProps = {
  booking: UserBookingSummary
  onBookingUpdated: (booking: UserBookingSummary) => void
}

export function BookingDetailPaymentActions({ booking, onBookingUpdated }: BookingDetailPaymentActionsProps) {
  const { colors } = useAppTheme()
  const [nowMs, setNowMs] = useState(() => Date.now())
  const needsPayment = needsBookingPayment(booking)

  const handleConfirmed = useCallback(async () => {
    const updated = await fetchBookingById(booking.id)
    if (updated) onBookingUpdated(updated)
    haptics.success()
    toast.success("Payment received. You're booked!")
  }, [booking.id, onBookingUpdated])

  const { displayText, isPaying, isWaiting, isConfirming, payLabel, handlePay, handleCheckStatus } =
    usePaymentCheckout({ bookingId: booking.id, onConfirmed: handleConfirmed })

  useEffect(() => {
    if (!needsPayment) return
    const intervalId = setInterval(() => setNowMs(Date.now()), 1000)
    return () => clearInterval(intervalId)
  }, [needsPayment])

  if (!needsPayment) return null

  const countdown = formatPaymentCountdown(booking.expiresAt, nowMs)
  const expiresAtMs = booking.expiresAt ? new Date(booking.expiresAt).getTime() : null
  const runningOut = expiresAtMs !== null && expiresAtMs - nowMs < HOLD_WARNING_MS

  return (
    <Card>
      <View style={styles.stack} accessibilityLiveRegion="polite">
        {isConfirming ? (
          <View style={styles.confirming}>
            <ActivityIndicator color={colors.accentText} />
            <AppText variant="headline">Confirming your payment…</AppText>
          </View>
        ) : (
          <AppText variant="title3">Pay to keep this booking</AppText>
        )}

        {countdown ? (
          <AppText variant="headline" color={runningOut ? "warning" : "secondaryLabel"}>
            {countdown}
          </AppText>
        ) : null}

        {displayText && !isConfirming ? (
          <AppText variant="callout" color="secondaryLabel">
            {displayText}
          </AppText>
        ) : null}

        {!isConfirming ? (
          <Button label={payLabel} onPress={handlePay} loading={isPaying} disabled={isWaiting} style={styles.pay} />
        ) : null}

        {isWaiting && !isConfirming ? (
          <Button label="I've paid, check now" variant="secondary" onPress={() => void handleCheckStatus()} />
        ) : null}
      </View>
    </Card>
  )
}

const styles = StyleSheet.create({
  stack: { gap: PlayTTSpacing.xs },
  confirming: { flexDirection: "row", alignItems: "center", gap: PlayTTSpacing.sm },
  pay: { marginTop: PlayTTSpacing.sm },
})
