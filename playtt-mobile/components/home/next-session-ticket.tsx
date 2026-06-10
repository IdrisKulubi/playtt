import { useMemo } from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"

import { IconSymbol } from "@/components/ui/icon-symbol"
import {
  PlayTTColors,
  PlayTTFontFamilies,
  PlayTTRadius,
  PlayTTSpacing,
} from "@/constants/playtt-tokens"
import { useProductTheme } from "@/hooks/use-product-theme"
import type { UserBookingSummary } from "@/lib/booking-types"
import {
  formatSessionCountdownLabel,
  formatTicketStatusLine,
  formatTicketTimeLine,
  isSessionWithinCountdownWindow,
} from "@/lib/booking-utils"

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
  const showBadge = isSessionWithinCountdownWindow(booking.startTime)
  const countdown = formatSessionCountdownLabel(booking.startTime)
  const timeLine = formatTicketTimeLine(
    booking.startTime,
    booking.endTime,
  )

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
        <Text style={styles.status}>
          {formatTicketStatusLine(booking)}
        </Text>
      </Pressable>
    </View>
  )
}
