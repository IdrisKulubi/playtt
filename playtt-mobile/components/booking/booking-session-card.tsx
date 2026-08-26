import { useEffect, useMemo, useState, type ReactNode } from "react"
import { StyleSheet, Text, View } from "react-native"

import { SessionTicketShell } from "@/components/booking/session-ticket-shell"
import {
  PlayTTColors,
  PlayTTFontFamilies,
} from "@/constants/playtt-tokens"
import { useProductTheme } from "@/hooks/use-product-theme"
import type { UserBookingSummary } from "@/lib/booking-types"
import {
  formatBookingStatus,
  formatKes,
  formatPaymentCountdown,
  formatSessionCountdownLabel,
  formatTicketStatusLine,
  formatTicketTimeLine,
  formatTimeRange,
  isSessionWithinCountdownWindow,
  needsBookingPayment,
} from "@/lib/booking-utils"
import { getVenueImage, locationFromBooking } from "@/lib/venue-assets"

type BookingSessionCardProps = {
  booking: UserBookingSummary
  onPress: () => void
  embedded?: boolean
  showPrice?: boolean
  useTicketTimeLine?: boolean
}

export function BookingSessionCard({
  booking,
  onPress,
  embedded = false,
  showPrice = false,
  useTicketTimeLine = false,
}: BookingSessionCardProps) {
  const theme = useProductTheme()
  const location = locationFromBooking(booking)
  const imageSource = getVenueImage(location)
  const [nowMs, setNowMs] = useState(Date.now())

  const showBadge = isSessionWithinCountdownWindow(booking.startTime, nowMs)
  const countdown = formatSessionCountdownLabel(booking.startTime, nowMs)
  const timeLine = useTicketTimeLine
    ? formatTicketTimeLine(booking.startTime, booking.endTime, nowMs)
    : formatTimeRange(booking.startTime, booking.endTime)
  const showPaymentNudge = needsBookingPayment(booking)
  const paymentCountdown = formatPaymentCountdown(booking.expiresAt, nowMs)

  useEffect(() => {
    if (!showPaymentNudge) {
      return
    }

    const intervalId = setInterval(() => setNowMs(Date.now()), 1000)
    return () => clearInterval(intervalId)
  }, [showPaymentNudge])

  const styles = useMemo(
    () =>
      StyleSheet.create({
        primaryLine: {
          fontSize: 15,
          fontFamily: PlayTTFontFamilies.semiBold,
          color: theme.foreground,
          lineHeight: 20,
        },
        primaryAccent: {
          color: PlayTTColors.primary,
        },
        secondaryLine: {
          fontSize: 13,
          fontFamily: PlayTTFontFamilies.regular,
          color: theme.muted,
          lineHeight: 18,
        },
        tertiaryLine: {
          fontSize: 13,
          fontFamily: PlayTTFontFamilies.regular,
          color: theme.muted,
          lineHeight: 18,
        },
        footerRow: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
        },
        footerPrimary: {
          flex: 1,
          fontSize: 13,
          fontFamily: PlayTTFontFamilies.medium,
          color: theme.foreground,
        },
        footerAction: {
          fontSize: 13,
          fontFamily: PlayTTFontFamilies.semiBold,
          color: PlayTTColors.primary,
        },
        footerMuted: {
          fontSize: 13,
          fontFamily: PlayTTFontFamilies.regular,
          color: theme.muted,
        },
      }),
    [theme],
  )

  const statusLine = useTicketTimeLine
    ? formatTicketStatusLine(booking)
    : formatBookingStatus(booking.status, booking.paymentStatus)

  const tertiaryText = showPrice
    ? `${statusLine} · ${formatKes(booking.totalAmount, booking.currency)}`
    : statusLine

  const primaryLine = (
    <Text style={styles.primaryLine} numberOfLines={2}>
      {showBadge ? (
        <>
          <Text style={styles.primaryAccent}>{countdown}</Text>
          <Text style={styles.primaryLine}> · {timeLine}</Text>
        </>
      ) : (
        timeLine
      )}
    </Text>
  )

  let footer: ReactNode = null

  if (showPaymentNudge) {
    footer = (
      <View style={styles.footerRow}>
        <Text style={styles.footerAction}>Complete payment</Text>
        {paymentCountdown ? (
          <Text style={styles.footerPrimary}>{paymentCountdown}</Text>
        ) : null}
      </View>
    )
  } else if (booking.status === "confirmed" && booking.paymentStatus === "paid") {
    footer = (
      <View style={styles.footerRow}>
        <Text style={styles.footerMuted}>Open booking for entry details</Text>
      </View>
    )
  }

  return (
    <SessionTicketShell
      imageSource={imageSource}
      imageLabel={`${booking.locationName} venue`}
      primary={primaryLine}
      secondary={
        <Text style={styles.secondaryLine} numberOfLines={1}>
          {booking.locationName}
        </Text>
      }
      tertiary={
        <Text style={styles.tertiaryLine} numberOfLines={1}>
          {tertiaryText}
        </Text>
      }
      footer={footer}
      embedded={embedded}
      onPress={onPress}
      accessibilityHint="Opens session details"
    />
  )
}
