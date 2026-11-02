import { useEffect, useState } from "react"
import { ActivityIndicator, StyleSheet, View } from "react-native"

import { BookingSummary } from "@/components/booking/flow/booking-summary"
import { Button } from "@/components/kit/button"
import { Card } from "@/components/kit/card"
import { AppText } from "@/components/ui/app-text"
import { PlayTTSpacing } from "@/constants/playtt-tokens"
import { useAppTheme } from "@/hooks/use-app-theme"
import { usePaymentCheckout } from "@/hooks/use-payment-checkout"
import type { CreateBookingResult } from "@/lib/booking-types"
import { formatKes, formatPaymentCountdown } from "@/lib/booking-utils"

/** Under this, the countdown turns orange so nobody is caught out. */
const HOLD_WARNING_MS = 2 * 60 * 1000

type PayStepProps = {
  confirmation: CreateBookingResult
  venue: string
  startIso: string
  endIso: string
  players: number
  onConfirmed: () => void
  onExpired: () => void
}

export function PayStep({ confirmation, venue, startIso, endIso, players, onConfirmed, onExpired }: PayStepProps) {
  const { colors } = useAppTheme()
  const [nowMs, setNowMs] = useState(() => Date.now())
  const { displayText, isPaying, isWaiting, isConfirming, payLabel, handlePay, handleCheckStatus } =
    usePaymentCheckout({ bookingId: confirmation.bookingId, onConfirmed })

  useEffect(() => {
    const intervalId = setInterval(() => setNowMs(Date.now()), 1000)
    return () => clearInterval(intervalId)
  }, [])

  const expiresAtMs = confirmation.expiresAt ? new Date(confirmation.expiresAt).getTime() : null
  const countdown = formatPaymentCountdown(confirmation.expiresAt, nowMs)
  const runningOut = expiresAtMs !== null && expiresAtMs - nowMs < HOLD_WARNING_MS

  useEffect(() => {
    if (expiresAtMs !== null && expiresAtMs <= nowMs) onExpired()
  }, [expiresAtMs, nowMs, onExpired])

  if (isConfirming) {
    return (
      <Card>
        <View style={styles.confirming} accessibilityLiveRegion="polite">
          <ActivityIndicator color={colors.accentText} size="large" />
          <AppText variant="title3">Confirming your payment</AppText>
          <AppText variant="body" color="secondaryLabel" style={styles.center}>
            This usually takes a few seconds.
          </AppText>
        </View>
      </Card>
    )
  }

  return (
    <View style={styles.stack}>
      <Card>
        <View style={styles.cardStack}>
          <AppText variant="body" color="secondaryLabel">
            We&apos;re holding this table for you. Pay with M-Pesa to confirm it.
          </AppText>
          <AppText variant="title1" tabular>
            {formatKes(confirmation.totalAmount, confirmation.currency)}
          </AppText>
          {countdown ? (
            <AppText variant="headline" color={runningOut ? "warning" : "secondaryLabel"} accessibilityLiveRegion="polite">
              {countdown}
            </AppText>
          ) : null}
          {displayText ? (
            <AppText variant="callout" color="secondaryLabel">
              {displayText}
            </AppText>
          ) : null}
          <Button label={payLabel} onPress={handlePay} loading={isPaying} disabled={isWaiting} style={styles.cta} />
          {isWaiting ? (
            <Button label="I've paid, check now" variant="secondary" onPress={() => void handleCheckStatus()} />
          ) : null}
        </View>
      </Card>
      <BookingSummary venue={venue} startIso={startIso} endIso={endIso} players={players} />
    </View>
  )
}

const styles = StyleSheet.create({
  stack: { gap: PlayTTSpacing.lg },
  cardStack: { gap: PlayTTSpacing.xs },
  cta: { marginTop: PlayTTSpacing.sm },
  confirming: { alignItems: "center", gap: PlayTTSpacing.sm, paddingVertical: PlayTTSpacing.lg },
  center: { textAlign: "center" },
})
