import { StyleSheet, View } from "react-native"

import { Button } from "@/components/kit/button"
import { Card } from "@/components/kit/card"
import { AppText } from "@/components/ui/app-text"
import { IconSymbol } from "@/components/ui/icon-symbol"
import { PlayTTSpacing } from "@/constants/playtt-tokens"
import { useAppTheme } from "@/hooks/use-app-theme"
import type { UserBookingSummary } from "@/lib/booking-types"
import {
  formatRelativeSessionStart,
  formatTimeRange,
  needsBookingPayment,
} from "@/lib/booking-utils"

type NextGameCardProps = {
  booking: UserBookingSummary
  /** Opens the booking (entry code, change, cancel). */
  onOpen: () => void
  onDirections: () => void
}

function formatDay(iso: string) {
  return new Date(iso).toLocaleDateString("en-KE", {
    weekday: "long",
    day: "numeric",
    month: "short",
  })
}

/** The Play tab's hero when a game is coming up: a ticket you can read at a glance. */
export function NextGameCard({ booking, onOpen, onDirections }: NextGameCardProps) {
  const { colors } = useAppTheme()
  const unpaid = needsBookingPayment(booking)

  return (
    // Not a pressable card: its buttons must stay reachable by screen readers.
    <Card>
      <View style={styles.stack}>
        <AppText variant="footnote" color="accentText" weight="600">
          {formatRelativeSessionStart(booking.startTime)}
        </AppText>
        <View>
          <AppText variant="title1" tabular>
            {formatTimeRange(booking.startTime, booking.endTime)}
          </AppText>
          <AppText variant="headline" color="secondaryLabel">
            {formatDay(booking.startTime)}
          </AppText>
        </View>

        <View style={[styles.divider, { backgroundColor: colors.separator }]} />

        <View style={styles.meta}>
          <View style={styles.metaItem}>
            <IconSymbol name="location.fill" size={18} color={colors.secondaryLabel} />
            <AppText variant="callout" style={styles.metaText}>
              {booking.locationName} · {booking.resourceName}
            </AppText>
          </View>
          <View style={styles.metaItem}>
            <IconSymbol name="person.2.fill" size={18} color={colors.secondaryLabel} />
            <AppText variant="callout" style={styles.metaText}>
              {booking.groupSize} players · {booking.durationMinutes} min
            </AppText>
          </View>
          {unpaid ? (
            <View style={styles.metaItem}>
              <IconSymbol name="exclamationmark.triangle.fill" size={18} color={colors.warning} />
              <AppText variant="callout" color="warning" weight="600" style={styles.metaText}>
                Pay to keep this booking
              </AppText>
            </View>
          ) : null}
        </View>

        <View style={styles.actions}>
          <Button
            label={unpaid ? "Pay now" : "Show entry code"}
            onPress={onOpen}
            style={styles.action}
          />
          <Button label="Directions" variant="secondary" onPress={onDirections} style={styles.action} />
        </View>
      </View>
    </Card>
  )
}

const styles = StyleSheet.create({
  stack: { gap: PlayTTSpacing.sm },
  divider: { height: StyleSheet.hairlineWidth },
  meta: { gap: PlayTTSpacing.xs },
  metaItem: { flexDirection: "row", alignItems: "center", gap: PlayTTSpacing.xs },
  metaText: { flex: 1 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: PlayTTSpacing.xs, marginTop: PlayTTSpacing.xs },
  action: { flexGrow: 1, flexBasis: 140 },
})
