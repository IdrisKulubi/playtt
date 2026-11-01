import { useEffect, useMemo, useState } from "react"
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native"

import { formatNairobiClock } from "@/components/community/player-card/card-tiers"
import { BottomSheet } from "@/components/ui/bottom-sheet"
import { Button } from "@/components/ui/button"
import { PlayTTColors, PlayTTFontFamilies, PlayTTRadius, PlayTTSpacing } from "@/constants/playtt-tokens"
import { useProductTheme } from "@/hooks/use-product-theme"
import { fetchMyBookings } from "@/lib/booking-api"
import type { UserBookingSummary } from "@/lib/booking-types"
import { chatDayLabel } from "@/lib/community-chat-merge"
import { toast } from "@/lib/toast"

type ChatActionsSheetProps = {
  visible: boolean
  partnerName: string
  onClose: () => void
  onBookTable: () => void
  onShareBooking: (bookingId: string) => void
}

/** Only confirmed bookings that haven't ended can be shared (the API checks too). */
export function shareableBookings(bookings: UserBookingSummary[], now = new Date()) {
  return bookings
    .filter((booking) => booking.status === "confirmed" && new Date(booking.endTime) > now)
    .sort((a, b) => a.startTime.localeCompare(b.startTime))
}

export function ChatActionsSheet({ visible, partnerName, onClose, onBookTable, onShareBooking }: ChatActionsSheetProps) {
  const theme = useProductTheme()
  const [bookings, setBookings] = useState<UserBookingSummary[] | null>(null)

  useEffect(() => {
    if (!visible) return
    let mounted = true
    fetchMyBookings("upcoming")
      .then((rows) => mounted && setBookings(shareableBookings(rows)))
      .catch((error) => {
        if (mounted) setBookings([])
        toast.apiError(error, "Could not load your bookings.")
      })
    return () => {
      mounted = false
    }
  }, [visible])

  const styles = useMemo(
    () =>
      StyleSheet.create({
        body: { gap: PlayTTSpacing.md },
        hint: { fontFamily: PlayTTFontFamilies.regular, fontSize: 14, color: theme.muted, lineHeight: 20 },
        label: { fontFamily: PlayTTFontFamilies.semiBold, fontSize: 14, color: theme.foreground },
        booking: {
          borderRadius: PlayTTRadius.lg,
          borderWidth: 1,
          borderColor: theme.border,
          padding: PlayTTSpacing.sm,
          gap: 2,
        },
        when: { fontFamily: PlayTTFontFamilies.semiBold, fontSize: 15, color: theme.foreground },
        where: { fontFamily: PlayTTFontFamilies.regular, fontSize: 13, color: theme.muted },
        share: { fontFamily: PlayTTFontFamilies.semiBold, fontSize: 13, color: PlayTTColors.primary, marginTop: 2 },
      }),
    [theme],
  )

  return (
    <BottomSheet visible={visible} title="Play together" onClose={onClose} scrollable>
      <View style={styles.body}>
        <Text style={styles.hint}>
          Agreed a time with {partnerName}? Book a table, then share it here so they have the details.
        </Text>
        <Button label="Book a table" surface="product" productTheme={theme} onPress={onBookTable} />

        <Text style={styles.label}>Share an upcoming booking</Text>
        {bookings === null ? (
          <ActivityIndicator color={theme.muted} />
        ) : bookings.length === 0 ? (
          <Text style={styles.hint}>No upcoming confirmed bookings yet.</Text>
        ) : (
          bookings.map((booking) => (
            <Pressable
              key={booking.id}
              accessibilityRole="button"
              accessibilityLabel={`Share ${booking.resourceName}, ${chatDayLabel(booking.startTime)} at ${formatNairobiClock(booking.startTime)}`}
              onPress={() => onShareBooking(booking.id)}
              style={styles.booking}
            >
              <Text style={styles.when}>
                {chatDayLabel(booking.startTime)} · {formatNairobiClock(booking.startTime)}–
                {formatNairobiClock(booking.endTime)}
              </Text>
              <Text style={styles.where}>
                {booking.resourceName} · {booking.locationName}
              </Text>
              <Text style={styles.share}>Share to chat</Text>
            </Pressable>
          ))
        )}
      </View>
    </BottomSheet>
  )
}
