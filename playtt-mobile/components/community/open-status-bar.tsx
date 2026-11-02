import { StyleSheet, View } from "react-native"
import { useReducedMotion } from "react-native-reanimated"

import { Button } from "@/components/kit/button"
import { Card } from "@/components/kit/card"
import { AppText } from "@/components/ui/app-text"
import { PlayTTSpacing } from "@/constants/playtt-tokens"
import { useAppTheme } from "@/hooks/use-app-theme"
import type { CommunityAvailability } from "@/lib/community-types"

import { formatNairobiClock } from "./player-card/card-tiers"
import { PulseDot } from "./player-card/card-status-ribbon"

const LATER_COPY = {
  now: "later",
  today: "today",
  tonight: "tonight",
  weekend: "this weekend",
} as const

/** "You're open · until 9PM" for me, "Open now · until 9PM" for someone else. */
export function availabilitySummary(availability: CommunityAvailability, subject: "me" | "player" = "me") {
  const until = formatNairobiClock(availability.endsAt)
  if (availability.openNow) {
    return `${subject === "me" ? "You're open" : "Open now"} · until ${until}`
  }
  const lead = subject === "me" ? "You're open" : "Open"
  return `${lead} ${LATER_COPY[availability.window]} · from ${formatNairobiClock(availability.startsAt)}`
}

type OpenStatusBarProps = {
  availability: CommunityAvailability
  onChange: () => void
  onStop: () => void
}

/** Your own "open to play" status as a card with two clear buttons: change it or stop. */
export function OpenStatusBar({ availability, onChange, onStop }: OpenStatusBarProps) {
  const { colors } = useAppTheme()
  const reduceMotion = useReducedMotion()
  const note = [availability.lookingForDoubles ? "Looking for doubles" : null, availability.note]
    .filter(Boolean)
    .join(" · ")

  return (
    <Card style={{ borderWidth: 1.5, borderColor: colors.success }}>
      <View style={styles.stack}>
        <View style={styles.titleRow}>
          <PulseDot color={colors.success} animate={availability.openNow && !reduceMotion} size={10} />
          <AppText variant="headline" style={styles.flex}>
            {availabilitySummary(availability)}
          </AppText>
        </View>
        {note ? (
          <AppText variant="callout" color="secondaryLabel">
            {note}
          </AppText>
        ) : null}
        <View style={styles.actions}>
          <Button
            label="Change"
            variant="secondary"
            fullWidth={false}
            accessibilityLabel="Change when you're open to play"
            onPress={onChange}
            style={styles.action}
          />
          <Button
            label="Stop"
            variant="destructive"
            fullWidth={false}
            accessibilityLabel="Stop being open to play"
            onPress={onStop}
            style={styles.action}
          />
        </View>
      </View>
    </Card>
  )
}

const styles = StyleSheet.create({
  stack: { gap: PlayTTSpacing.xs },
  titleRow: { flexDirection: "row", alignItems: "center", gap: PlayTTSpacing.xs },
  flex: { flex: 1 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: PlayTTSpacing.xs, marginTop: PlayTTSpacing.xs },
  action: { flexGrow: 1 },
})
