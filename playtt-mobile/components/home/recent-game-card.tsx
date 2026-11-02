import { StyleSheet, View } from "react-native"

import { Button } from "@/components/kit/button"
import { Card } from "@/components/kit/card"
import { AppText } from "@/components/ui/app-text"
import { PlayTTSpacing } from "@/constants/playtt-tokens"
import type { UserBookingSummary } from "@/lib/booking-types"

/** How long after a game the Play tab keeps asking "How did it go?". */
export const RECENT_GAME_WINDOW_MS = 6 * 60 * 60 * 1000

export function isRecentGame(booking: UserBookingSummary | null, nowMs = Date.now()) {
  if (!booking) return false
  const ended = new Date(booking.endTime).getTime()
  return ended <= nowMs && nowMs - ended <= RECENT_GAME_WINDOW_MS
}

type RecentGameCardProps = {
  booking: UserBookingSummary
  onSeeReplays: () => void
}

/** Right after a game, lead people to their replays while it's still fresh. */
export function RecentGameCard({ booking, onSeeReplays }: RecentGameCardProps) {
  return (
    <Card>
      <View style={styles.stack}>
        <AppText variant="title3" accessibilityRole="header">
          How did it go?
        </AppText>
        <AppText variant="body" color="secondaryLabel">
          Your game at {booking.locationName} just ended. Replays show up in Progress once they&apos;re ready.
        </AppText>
        <Button label="See my replays" variant="secondary" onPress={onSeeReplays} style={styles.cta} />
      </View>
    </Card>
  )
}

const styles = StyleSheet.create({
  stack: { gap: PlayTTSpacing.xs },
  cta: { marginTop: PlayTTSpacing.xs },
})
