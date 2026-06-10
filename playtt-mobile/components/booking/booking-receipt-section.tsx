import { useMemo } from "react"
import { StyleSheet, Text, View } from "react-native"

import {
  PlayTTColors,
  PlayTTFontFamilies,
  PlayTTSpacing,
} from "@/constants/playtt-tokens"
import { useProductTheme } from "@/hooks/use-product-theme"
import type { UserBookingSummary } from "@/lib/booking-types"
import { formatKes, formatPaymentStatus } from "@/lib/booking-utils"

type BookingReceiptSectionProps = {
  booking: UserBookingSummary
}

export function BookingReceiptSection({ booking }: BookingReceiptSectionProps) {
  const theme = useProductTheme()
  const styles = useMemo(
    () =>
      StyleSheet.create({
        card: {
          gap: PlayTTSpacing.sm,
          borderWidth: 1,
          borderColor: theme.border,
          borderRadius: 12,
          padding: PlayTTSpacing.md,
          backgroundColor: theme.elevated,
        },
        title: {
          fontSize: 14,
          fontFamily: PlayTTFontFamilies.semiBold,
          color: theme.foreground,
        },
        row: {
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        },
        label: {
          fontSize: 13,
          fontFamily: PlayTTFontFamilies.regular,
          color: theme.muted,
        },
        value: {
          fontSize: 13,
          fontFamily: PlayTTFontFamilies.medium,
          color: theme.foreground,
        },
        total: {
          fontSize: 16,
          fontFamily: PlayTTFontFamilies.semiBold,
          color: PlayTTColors.primary,
        },
        divider: {
          height: StyleSheet.hairlineWidth,
          backgroundColor: theme.border,
          marginVertical: PlayTTSpacing.xs,
        },
      }),
    [theme],
  )

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Receipt</Text>
      <View style={styles.row}>
        <Text style={styles.label}>Subtotal</Text>
        <Text style={styles.value}>
          {formatKes(booking.subtotalAmount, booking.currency)}
        </Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Payment</Text>
        <Text style={styles.value}>
          {formatPaymentStatus(booking.paymentStatus)}
        </Text>
      </View>
      <View style={styles.divider} />
      <View style={styles.row}>
        <Text style={styles.label}>Total</Text>
        <Text style={styles.total}>
          {formatKes(booking.totalAmount, booking.currency)}
        </Text>
      </View>
    </View>
  )
}
