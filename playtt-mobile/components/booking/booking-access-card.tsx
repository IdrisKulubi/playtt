import { useMemo } from "react"
import { StyleSheet, Text, View } from "react-native"

import { Button } from "@/components/ui/button"
import { PreviewBadge } from "@/components/ui/preview-badge"
import {
  PlayTTColors,
  PlayTTFontFamilies,
  PlayTTSpacing,
} from "@/constants/playtt-tokens"
import { useProductTheme } from "@/hooks/use-product-theme"
import type { UserBookingSummary } from "@/lib/booking-types"
import { formatTimeRange } from "@/lib/booking-utils"
import { mockEntryCode } from "@/lib/mock/mock-access"

type BookingAccessCardProps = {
  booking: UserBookingSummary
}

export function BookingAccessCard({ booking }: BookingAccessCardProps) {
  const theme = useProductTheme()
  const entryCode = mockEntryCode(booking.id)
  const styles = useMemo(
    () =>
      StyleSheet.create({
        card: {
          gap: PlayTTSpacing.sm,
          borderWidth: 1,
          borderColor: "rgba(0, 183, 255, 0.35)",
          borderRadius: 12,
          padding: PlayTTSpacing.md,
          backgroundColor: theme.card,
          overflow: "hidden",
        },
        glow: {
          ...StyleSheet.absoluteFillObject,
          backgroundColor: PlayTTColors.primaryGlow,
          opacity: 0.2,
          borderRadius: 12,
        },
        header: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        },
        title: {
          fontSize: 15,
          fontFamily: PlayTTFontFamilies.semiBold,
          color: theme.foreground,
        },
        code: {
          fontSize: 32,
          fontFamily: PlayTTFontFamilies.semiBold,
          color: theme.foreground,
          letterSpacing: 6,
          textAlign: "center",
          marginVertical: PlayTTSpacing.sm,
        },
        meta: {
          fontSize: 13,
          fontFamily: PlayTTFontFamilies.regular,
          color: theme.muted,
          lineHeight: 18,
        },
      }),
    [theme],
  )

  return (
    <View style={styles.card}>
      <View style={styles.glow} pointerEvents="none" />
      <View style={styles.header}>
        <Text style={styles.title}>Your entry code</Text>
        <PreviewBadge label="Preview" />
      </View>
      <Text style={styles.code}>{entryCode}</Text>
      <Text style={styles.meta}>
        Valid {formatTimeRange(booking.startTime, booking.endTime)}
      </Text>
      <Text style={styles.meta}>
        Your real code will appear here before your session.
      </Text>
      <Button
        label="Tap to unlock"
        surface="product"
        productTheme={theme}
        disabled
        onPress={() => {}}
      />
      <Text style={styles.meta}>
        Unlock activates when you arrive at the venue.
      </Text>
    </View>
  )
}
