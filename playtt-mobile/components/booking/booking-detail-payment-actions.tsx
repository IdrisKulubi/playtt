import { useCallback, useEffect, useMemo, useState } from "react"
import { StyleSheet, Text, View } from "react-native"

import { PaymentMethodPicker } from "@/components/booking/payment-method-picker"
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
import type { PaymentMethodChoice, UserBookingSummary } from "@/lib/booking-types"
import { formatPaymentCountdown } from "@/lib/booking-utils"
import { openCardCheckout } from "@/lib/payment-browser"
import { fetchCurrentUser } from "@/lib/user-api"
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

  const [method, setMethod] = useState<PaymentMethodChoice>("mpesa")
  const [phone, setPhone] = useState("")
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

    let mounted = true

    async function loadPhone() {
      try {
        const response = await fetchCurrentUser()
        if (mounted) {
          setPhone(response.data?.user?.phone ?? "")
        }
      } catch {
        // Manual entry still works.
      }
    }

    void loadPhone()

    return () => {
      mounted = false
    }
  }, [needsPayment])

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
      const result = await initiateBookingPayment(booking.id, {
        method,
        phone: method === "mpesa" ? phone.trim() || undefined : undefined,
      })

      setDisplayText(result.displayText)

      if (method === "card" && result.authorizationUrl) {
        const browserResult = await openCardCheckout(result.authorizationUrl)

        if (browserResult.type === "cancel") {
          toast.info("Card checkout closed. You can try again.")
          return
        }

        setIsWaiting(true)
        await refreshBooking()
        return
      }

      setIsWaiting(true)
      toast.info("Check your phone for the M-Pesa prompt.")
    } catch (error) {
      toast.apiError(
        error,
        method === "card"
          ? "Could not start card payment."
          : "Could not start M-Pesa payment.",
      )
    } finally {
      setIsPaying(false)
    }
  }

  if (!needsPayment) {
    return null
  }

  const countdown = formatPaymentCountdown(booking.expiresAt, nowMs)
  const payLabel =
    method === "card"
      ? isWaiting
        ? "Waiting for payment…"
        : "Pay with card"
      : isWaiting
        ? "Waiting for payment…"
        : "Pay now"

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>How would you like to pay?</Text>

      {countdown ? <Text style={styles.countdown}>{countdown}</Text> : null}

      <PaymentMethodPicker
        value={method}
        onChange={setMethod}
        theme={theme}
        disabled={isWaiting}
      />

      {method === "mpesa" && !isWaiting ? (
        <View style={styles.phoneField}>
          <Text style={styles.label}>M-Pesa phone number</Text>
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
        <Text style={styles.displayText}>{displayText}</Text>
      ) : isWaiting && method === "mpesa" ? (
        <Text style={styles.displayText}>
          Check your phone and enter your M-Pesa PIN.
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
    phoneField: {
      gap: PlayTTSpacing.xs,
    },
    label: {
      fontSize: 13,
      fontFamily: PlayTTFontFamilies.medium,
      color: muted,
    },
    displayText: {
      fontSize: 14,
      fontFamily: PlayTTFontFamilies.regular,
      color: muted,
      lineHeight: 20,
    },
  })
}
