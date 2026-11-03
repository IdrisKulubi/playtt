import { type ComponentProps, useState } from "react"
import { StyleSheet, View } from "react-native"

import { BookingAccessCard } from "@/components/booking/booking-access-card"
import { BookingCancelActions } from "@/components/booking/booking-cancel-actions"
import { BookingEditFlow } from "@/components/booking/booking-edit-flow"
import { BookingDetailPaymentActions } from "@/components/booking/booking-detail-payment-actions"
import { BookingPastSessionCard } from "@/components/booking/booking-past-session-card"
import { BookingReceiptSection } from "@/components/booking/booking-receipt-section"
import { Button } from "@/components/kit/button"
import { Card } from "@/components/kit/card"
import { ListRow } from "@/components/kit/list-row"
import { ListSection } from "@/components/kit/list-section"
import { AppText } from "@/components/ui/app-text"
import { IconSymbol } from "@/components/ui/icon-symbol"
import { PlayTTSpacing } from "@/constants/playtt-tokens"
import { useAppTheme } from "@/hooks/use-app-theme"
import type { UserBookingSummary } from "@/lib/booking-types"
import { addGameToCalendar } from "@/lib/calendar"
import {
  formatKes,
  formatTimeRange,
  isPastBooking,
  needsBookingPayment,
} from "@/lib/booking-utils"

type BookingDetailContentProps = {
  booking: UserBookingSummary
  /** @deprecated The redesign theme follows the phone's light/dark setting. */
  surface?: "dark" | "product"
  onBookingUpdated?: (booking: UserBookingSummary) => void
  onBookingCancelled?: () => void
}

type StatusTone = "success" | "warning" | "secondaryLabel"

function bookingStatus(booking: UserBookingSummary): {
  icon: ComponentProps<typeof IconSymbol>["name"]
  word: string
  tone: StatusTone
} {
  if (booking.status === "cancelled") return { icon: "xmark.circle.fill", word: "Cancelled", tone: "secondaryLabel" }
  if (needsBookingPayment(booking)) {
    return { icon: "exclamationmark.triangle.fill", word: "Pay to keep this booking", tone: "warning" }
  }
  if (booking.status === "confirmed" || booking.paymentStatus === "paid") {
    return { icon: "checkmark.circle.fill", word: "Confirmed", tone: "success" }
  }
  return { icon: "info.circle.fill", word: "Booked", tone: "secondaryLabel" }
}

function formatDay(iso: string) {
  return new Date(iso).toLocaleDateString("en-KE", { weekday: "long", day: "numeric", month: "long" })
}

export function BookingDetailContent({
  booking,
  onBookingUpdated,
  onBookingCancelled,
}: BookingDetailContentProps) {
  const { colors } = useAppTheme()
  const [editFlowVisible, setEditFlowVisible] = useState(false)
  const status = bookingStatus(booking)

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <AppText variant="title1" tabular>
          {formatTimeRange(booking.startTime, booking.endTime)}
        </AppText>
        <AppText variant="headline" color="secondaryLabel">
          {formatDay(booking.startTime)}
        </AppText>
        <View style={styles.status}>
          <IconSymbol name={status.icon} size={18} color={colors[status.tone]} />
          <AppText variant="callout" weight="600" color={status.tone}>
            {status.word}
          </AppText>
        </View>
      </View>

      <ListSection>
        <ListRow icon="location.fill" title="Where" subtitle={`${booking.locationName} · ${booking.resourceName}`} />
        <ListRow icon="person.2.fill" title="Players" subtitle={`${booking.groupSize} players · ${booking.durationMinutes} min`} />
        <ListRow
          icon="checkmark"
          tone="success"
          title="Total"
          accessory={{ kind: "value", value: formatKes(booking.totalAmount, booking.currency) }}
        />
        {booking.expiresAt && needsBookingPayment(booking) ? (
          <ListRow
            icon="clock.fill"
            tone="warning"
            title="Held until"
            subtitle={new Date(booking.expiresAt).toLocaleString("en-KE", {
              weekday: "short",
              hour: "numeric",
              minute: "2-digit",
            })}
          />
        ) : null}
        {booking.notes ? <ListRow icon="info.circle.fill" tone="neutral" title="Your note" subtitle={booking.notes} /> : null}
      </ListSection>

      <BookingAccessCard booking={booking} />

      {onBookingUpdated ? (
        <BookingDetailPaymentActions booking={booking} onBookingUpdated={onBookingUpdated} />
      ) : null}

      {booking.status !== "cancelled" && booking.status !== "expired" && !isPastBooking(booking) ? (
        <Button
          label="Add to calendar"
          variant="secondary"
          accessibilityHint="Opens your calendar with this game filled in"
          onPress={() =>
            void addGameToCalendar({
              venue: booking.locationName,
              table: booking.resourceName,
              startIso: booking.startTime,
              endIso: booking.endTime,
              players: booking.groupSize,
            })
          }
        />
      ) : null}

      {booking.editable ? (
        <Button label="Change booking" variant="secondary" onPress={() => setEditFlowVisible(true)} />
      ) : booking.editBlockedReason ? (
        <Card>
          <View style={styles.blocked}>
            <AppText variant="headline">Changes close 2 hours before you play</AppText>
            <AppText variant="callout" color="secondaryLabel">
              {booking.editBlockedReason}
            </AppText>
          </View>
        </Card>
      ) : null}

      {onBookingCancelled ? (
        <BookingCancelActions booking={booking} onCancelled={onBookingCancelled} />
      ) : null}

      <BookingReceiptSection booking={booking} />

      {isPastBooking(booking) ? <BookingPastSessionCard /> : null}

      {onBookingUpdated ? (
        <BookingEditFlow
          booking={booking}
          visible={editFlowVisible}
          onClose={() => setEditFlowVisible(false)}
          onUpdated={onBookingUpdated}
        />
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { gap: PlayTTSpacing.lg },
  header: { gap: PlayTTSpacing["2xs"] },
  status: {
    flexDirection: "row",
    alignItems: "center",
    gap: PlayTTSpacing.xs,
    marginTop: PlayTTSpacing.xs,
  },
  blocked: { gap: PlayTTSpacing["2xs"] },
})
