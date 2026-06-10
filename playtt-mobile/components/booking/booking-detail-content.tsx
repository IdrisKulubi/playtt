import { useState } from "react"
import { StyleSheet, Text, View } from "react-native"

import { BookingEditFlow } from "@/components/booking/booking-edit-flow"
import { BookingDetailPaymentActions } from "@/components/booking/booking-detail-payment-actions"
import { Button } from "@/components/ui/button"
import {
  PlayTTColors,
  PlayTTFontFamilies,
  PlayTTSpacing,
  PlayTTTypography,
} from "@/constants/playtt-tokens"
import { ProductThemes } from "@/constants/product-theme"
import { useProductTheme, useSkeletonSurface } from "@/hooks/use-product-theme"
import type { UserBookingSummary } from "@/lib/booking-types"
import {
  formatBookingStatus,
  formatKes,
  formatTimeRange,
} from "@/lib/booking-utils"

type BookingDetailContentProps = {
  booking: UserBookingSummary
  surface?: "dark" | "product"
  onBookingUpdated?: (booking: UserBookingSummary) => void
}

export function BookingDetailContent({
  booking,
  surface,
  onBookingUpdated,
}: BookingDetailContentProps) {
  const [editFlowVisible, setEditFlowVisible] = useState(false)
  const defaultSurface = useSkeletonSurface()
  const resolvedSurface = surface ?? defaultSurface
  const productTheme = useProductTheme()
  const theme =
    resolvedSurface === "product" ? ProductThemes.light : ProductThemes.dark

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: theme.foreground }]}>
        {booking.locationName}
      </Text>
      <Text style={[styles.subtitle, { color: theme.muted }]}>
        {booking.resourceName}
      </Text>
      <Text style={[styles.time, { color: theme.foreground }]}>
        {formatTimeRange(booking.startTime, booking.endTime)}
      </Text>
      <Text style={[styles.status, { color: theme.muted }]}>
        {formatBookingStatus(booking.status, booking.paymentStatus)}
      </Text>
      <Text style={[styles.meta, { color: theme.muted }]}>
        {booking.groupSize} players
      </Text>
      <Text style={styles.price}>
        {formatKes(booking.totalAmount, booking.currency)}
      </Text>
      {booking.expiresAt ? (
        <Text style={[styles.meta, { color: theme.muted }]}>
          Hold expires:{" "}
          {new Date(booking.expiresAt).toLocaleString("en-KE")}
        </Text>
      ) : null}
      {booking.notes ? (
        <Text style={[styles.meta, { color: theme.muted }]}>
          Notes: {booking.notes}
        </Text>
      ) : null}

      {booking.editable ? (
        <Button
          label="Edit booking"
          surface="product"
          productTheme={productTheme}
          onPress={() => setEditFlowVisible(true)}
        />
      ) : booking.editBlockedReason ? (
        <View style={[styles.blockedCard, { borderColor: theme.border }]}>
          <Text style={[styles.blockedTitle, { color: theme.foreground }]}>
            Edits close 2 hours before start
          </Text>
          <Text style={[styles.meta, { color: theme.muted }]}>
            {booking.editBlockedReason}
          </Text>
          <Text style={[styles.meta, { color: theme.muted }]}>
            {formatTimeRange(booking.startTime, booking.endTime)} ·{" "}
            {booking.groupSize} players
          </Text>
        </View>
      ) : null}

      {onBookingUpdated ? (
        <BookingEditFlow
          booking={booking}
          visible={editFlowVisible}
          onClose={() => setEditFlowVisible(false)}
          onUpdated={onBookingUpdated}
        />
      ) : null}

      {onBookingUpdated ? (
        <BookingDetailPaymentActions
          booking={booking}
          onBookingUpdated={onBookingUpdated}
        />
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    gap: PlayTTSpacing.sm,
  },
  title: {
    ...PlayTTTypography.headline,
    fontFamily: PlayTTFontFamilies.semiBold,
  },
  subtitle: {
    fontSize: 15,
    fontFamily: PlayTTFontFamilies.medium,
  },
  time: {
    fontSize: 20,
    fontFamily: PlayTTFontFamilies.semiBold,
    marginTop: PlayTTSpacing.xs,
  },
  status: {
    fontSize: 14,
    fontFamily: PlayTTFontFamilies.regular,
  },
  price: {
    fontSize: 18,
    fontFamily: PlayTTFontFamilies.semiBold,
    color: PlayTTColors.primary,
    marginTop: PlayTTSpacing.xs,
  },
  meta: {
    fontSize: 13,
    fontFamily: PlayTTFontFamilies.regular,
  },
  blockedCard: {
    gap: PlayTTSpacing.xs,
    borderWidth: 1,
    borderRadius: 12,
    padding: PlayTTSpacing.md,
    marginTop: PlayTTSpacing.xs,
  },
  blockedTitle: {
    fontSize: 14,
    fontFamily: PlayTTFontFamilies.semiBold,
  },
})
