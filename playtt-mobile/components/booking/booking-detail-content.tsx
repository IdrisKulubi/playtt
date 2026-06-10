import { StyleSheet, Text, View } from "react-native"

import { BookingDetailPaymentActions } from "@/components/booking/booking-detail-payment-actions"
import {
  PlayTTColors,
  PlayTTFontFamilies,
  PlayTTSpacing,
  PlayTTTypography,
} from "@/constants/playtt-tokens"
import { ProductThemes } from "@/constants/product-theme"
import { useSkeletonSurface } from "@/hooks/use-product-theme"
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
  const defaultSurface = useSkeletonSurface()
  const resolvedSurface = surface ?? defaultSurface
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
})
