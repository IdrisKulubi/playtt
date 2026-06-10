import { useCallback, useEffect, useMemo, useState } from "react"
import { StyleSheet, Text, View } from "react-native"

import { createBookingFlowStyles } from "@/components/booking/booking-theme"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
import { fetchCurrentUser } from "@/lib/user-api"
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

  const [phone, setPhone] = useState("")
  const [displayText, setDisplayText] = useState<string | null>(null)
  const [isPaying, setIsPaying] = useState(false)
  const [isWaiting, setIsWaiting] = useState(false)
  const [nowMs, setNowMs] = useState(Date.now())

  useEffect(() => {
    let mounted = true

    async function loadPhone() {
      try {
        const response = await fetchCurrentUser()
        if (mounted) {
          setPhone(response.data?.user?.phone ?? "")
        }
      } catch {
        // User can still enter phone manually.
      }
    }

    void loadPhone()

    return () => {
      mounted = false
    }
  }, [])

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
      const result = await initiateBookingPayment(
        confirmation.bookingId,
        phone.trim() || undefined,
      )

      setDisplayText(result.displayText)
      setIsWaiting(true)
      toast.info("Check your phone for the M-Pesa prompt.")
    } catch (error) {
      toast.apiError(error, "Could not start M-Pesa payment.")
    } finally {
      setIsPaying(false)
    }
  }

  return (
    <View style={styles.section}>
      <Text style={styles.confirmedTitle}>Pay with M-Pesa</Text>
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

      {!isWaiting ? (
        <View style={localStyles.phoneField}>
          <Text style={localStyles.label}>M-Pesa phone number</Text>
          <Input
            variant="product"
            value={phone}
            onChangeText={setPhone}
            placeholder="07XX XXX XXX"
            keyboardType="phone-pad"
            autoComplete="tel"
          />
        </View>
      ) : null}

      {displayText ? (
        <Text style={localStyles.displayText}>{displayText}</Text>
      ) : isWaiting ? (
        <Text style={localStyles.displayText}>
          Check your phone and enter your M-Pesa PIN.
        </Text>
      ) : null}

      <Button
        label={isWaiting ? "Waiting for payment…" : "Pay with M-Pesa"}
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
    phoneField: {
      gap: PlayTTSpacing.xs,
      marginTop: PlayTTSpacing.md,
    },
    label: {
      fontSize: 13,
      fontFamily: PlayTTFontFamilies.medium,
      color: muted,
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
