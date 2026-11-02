import { useEffect, useState } from "react"
import { ActivityIndicator, StyleSheet, View } from "react-native"

import { formatNairobiClock } from "@/components/community/player-card/card-tiers"
import { Button } from "@/components/kit/button"
import { ListRow } from "@/components/kit/list-row"
import { ListSection } from "@/components/kit/list-section"
import { AppText } from "@/components/ui/app-text"
import { BottomSheet } from "@/components/ui/bottom-sheet"
import { PlayTTSpacing } from "@/constants/playtt-tokens"
import { useAppTheme } from "@/hooks/use-app-theme"
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

/** The chat's "+" sheet: book a table, or share one you already have. */
export function ChatActionsSheet({ visible, partnerName, onClose, onBookTable, onShareBooking }: ChatActionsSheetProps) {
  const { colors } = useAppTheme()
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

  return (
    <BottomSheet visible={visible} title="Play together" onClose={onClose} scrollable>
      <View style={styles.body}>
        <AppText variant="body" color="secondaryLabel">
          Agreed a time with {partnerName}? Book a table, then share it here so they have the details.
        </AppText>
        <Button label="Book a table" onPress={onBookTable} />

        {bookings === null ? (
          <ActivityIndicator color={colors.secondaryLabel} />
        ) : bookings.length === 0 ? (
          <AppText variant="callout" color="secondaryLabel">
            You don&apos;t have any confirmed bookings coming up to share yet.
          </AppText>
        ) : (
          <ListSection header="Share a booking you already have">
            {bookings.map((booking) => (
              <ListRow
                key={booking.id}
                icon="square.and.arrow.up"
                title={`${chatDayLabel(booking.startTime)} · ${formatNairobiClock(booking.startTime)} to ${formatNairobiClock(booking.endTime)}`}
                subtitle={`${booking.resourceName} · ${booking.locationName}`}
                accessibilityHint="Shares this booking in the chat"
                onPress={() => onShareBooking(booking.id)}
              />
            ))}
          </ListSection>
        )}
      </View>
    </BottomSheet>
  )
}

const styles = StyleSheet.create({
  body: { gap: PlayTTSpacing.md },
})
