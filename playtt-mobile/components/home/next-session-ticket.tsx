import { useEffect, useMemo, useState } from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"

import { IconSymbol } from "@/components/ui/icon-symbol"
import { PreviewBadge } from "@/components/ui/preview-badge"
import {
  PlayTTColors,
  PlayTTFontFamilies,
  PlayTTRadius,
  PlayTTSpacing,
} from "@/constants/playtt-tokens"
import { useProductTheme } from "@/hooks/use-product-theme"
import type { UserBookingSummary } from "@/lib/booking-types"
import {
  canShowEntryCodeTeaser,
  formatPaymentCountdown,
  formatSessionCountdownLabel,
  formatTicketStatusLine,
  formatTicketTimeLine,
  isEntryCodeTeaserDay,
  isSessionWithinCountdownWindow,
  needsBookingPayment,
} from "@/lib/booking-utils"
import { mockEntryCode } from "@/lib/mock/mock-access"

type NextSessionTicketProps = {
  booking: UserBookingSummary
  onPress: () => void
  embedded?: boolean
}

export function NextSessionTicket({
  booking,
  onPress,
  embedded = false,
}: NextSessionTicketProps) {
  const theme = useProductTheme()
  const [nowMs, setNowMs] = useState(Date.now())
  const showBadge = isSessionWithinCountdownWindow(booking.startTime, nowMs)
  const countdown = formatSessionCountdownLabel(booking.startTime, nowMs)
  const timeLine = formatTicketTimeLine(booking.startTime, booking.endTime, nowMs)
  const showPaymentNudge = needsBookingPayment(booking)
  const showEntryCode = canShowEntryCodeTeaser(booking, nowMs)
  const entryCodeReady = isEntryCodeTeaserDay(booking.startTime, nowMs)
  const entryCode = mockEntryCode(booking.id)

  useEffect(() => {
    if (!showPaymentNudge) {
      return
    }

    const intervalId = setInterval(() => setNowMs(Date.now()), 1000)
    return () => clearInterval(intervalId)
  }, [showPaymentNudge])

  const paymentCountdown = formatPaymentCountdown(booking.expiresAt, nowMs)

  const styles = useMemo(
    () =>
      StyleSheet.create({
        ticket: {
          borderRadius: embedded ? PlayTTRadius.lg : PlayTTRadius.panel,
          borderWidth: embedded ? 0 : 1,
          borderColor: theme.border,
          backgroundColor: theme.card,
          overflow: "hidden",
        },
        body: {
          padding: PlayTTSpacing.md,
          gap: PlayTTSpacing.sm,
        },
        topRow: {
          flexDirection: "row",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: PlayTTSpacing.sm,
        },
        topCopy: {
          flex: 1,
          gap: PlayTTSpacing.xs,
        },
        badge: {
          alignSelf: "flex-start",
          paddingHorizontal: PlayTTSpacing.sm,
          paddingVertical: PlayTTSpacing["2xs"],
          borderRadius: 999,
          backgroundColor: PlayTTColors.primaryGlow,
        },
        badgeText: {
          fontSize: 12,
          fontFamily: PlayTTFontFamilies.semiBold,
          color: PlayTTColors.primary,
        },
        location: {
          fontSize: 22,
          fontFamily: PlayTTFontFamilies.semiBold,
          color: theme.foreground,
          letterSpacing: -0.3,
        },
        time: {
          fontSize: 15,
          fontFamily: PlayTTFontFamilies.medium,
          color: theme.foreground,
        },
        status: {
          fontSize: 13,
          fontFamily: PlayTTFontFamilies.regular,
          color: theme.muted,
          lineHeight: 18,
        },
        pressed: {
          opacity: 0.85,
        },
        footer: {
          marginTop: PlayTTSpacing.xs,
          paddingTop: PlayTTSpacing.sm,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: theme.border,
          gap: PlayTTSpacing.xs,
        },
        paymentRow: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: PlayTTSpacing.sm,
        },
        paymentLabel: {
          fontSize: 14,
          fontFamily: PlayTTFontFamilies.semiBold,
          color: PlayTTColors.primary,
        },
        paymentCountdown: {
          fontSize: 13,
          fontFamily: PlayTTFontFamilies.semiBold,
          color: theme.foreground,
        },
        entryHeader: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        },
        entryLabel: {
          fontSize: 13,
          fontFamily: PlayTTFontFamilies.medium,
          color: theme.muted,
        },
        entryCode: {
          fontSize: 20,
          fontFamily: PlayTTFontFamilies.semiBold,
          color: theme.foreground,
          letterSpacing: 4,
        },
        entryHint: {
          fontSize: 13,
          fontFamily: PlayTTFontFamilies.regular,
          color: theme.muted,
          lineHeight: 18,
        },
      }),
    [embedded, theme],
  )

  return (
    <View style={styles.ticket}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityHint="Opens session details"
        style={({ pressed }) => [styles.body, pressed && styles.pressed]}
      >
        <View style={styles.topRow}>
          <View style={styles.topCopy}>
            {showBadge ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{countdown}</Text>
              </View>
            ) : null}
            <Text style={styles.location}>{booking.locationName}</Text>
          </View>
          <IconSymbol name="chevron.right" size={20} color={theme.muted} />
        </View>
        <Text style={styles.time}>{timeLine}</Text>
        <Text style={styles.status}>{formatTicketStatusLine(booking)}</Text>

        {showPaymentNudge || showEntryCode ? (
          <View style={styles.footer}>
            {showPaymentNudge ? (
              <View style={styles.paymentRow}>
                <Text style={styles.paymentLabel}>Complete payment</Text>
                {paymentCountdown ? (
                  <Text style={styles.paymentCountdown}>{paymentCountdown}</Text>
                ) : null}
              </View>
            ) : null}

            {showEntryCode ? (
              <View style={{ gap: PlayTTSpacing["2xs"] }}>
                <View style={styles.entryHeader}>
                  <Text style={styles.entryLabel}>Your entry code</Text>
                  <PreviewBadge label="Preview" />
                </View>
                {entryCodeReady ? (
                  <Text style={styles.entryCode}>{entryCode}</Text>
                ) : (
                  <Text style={styles.entryHint}>
                    Available before your session
                  </Text>
                )}
              </View>
            ) : null}
          </View>
        ) : null}
      </Pressable>
    </View>
  )
}
