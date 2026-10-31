import { useMemo } from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"
import { useReducedMotion } from "react-native-reanimated"

import { PlayTTFontFamilies, PlayTTSpacing } from "@/constants/playtt-tokens"
import { useProductTheme } from "@/hooks/use-product-theme"
import type { CommunityAvailability } from "@/lib/community-types"

import { OPEN_NOW_GREEN, formatNairobiClock } from "./player-card/card-tiers"
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

export function OpenStatusBar({ availability, onChange, onStop }: OpenStatusBarProps) {
  const theme = useProductTheme()
  const reduceMotion = useReducedMotion()

  const styles = useMemo(
    () =>
      StyleSheet.create({
        bar: {
          flexDirection: "row",
          alignItems: "center",
          gap: PlayTTSpacing.sm,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: "rgba(46, 232, 122, 0.45)",
          backgroundColor: "rgba(46, 232, 122, 0.10)",
          paddingVertical: PlayTTSpacing.sm,
          paddingHorizontal: PlayTTSpacing.md,
        },
        copy: { flex: 1, gap: 2 },
        title: { fontFamily: PlayTTFontFamilies.semiBold, fontSize: 15, color: theme.foreground },
        note: { fontFamily: PlayTTFontFamilies.regular, fontSize: 13, color: theme.muted },
        stop: { fontFamily: PlayTTFontFamilies.semiBold, fontSize: 14, color: theme.foreground },
        stopButton: {
          paddingHorizontal: PlayTTSpacing.sm,
          paddingVertical: 6,
          borderRadius: 999,
          backgroundColor: theme.elevated,
        },
      }),
    [theme],
  )

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${availabilitySummary(availability)}. Change status`}
      onPress={onChange}
      style={styles.bar}
    >
      <PulseDot color={OPEN_NOW_GREEN} animate={availability.openNow && !reduceMotion} size={9} />
      <View style={styles.copy}>
        <Text style={styles.title}>{availabilitySummary(availability)}</Text>
        {availability.note || availability.lookingForDoubles ? (
          <Text style={styles.note} numberOfLines={1}>
            {[availability.lookingForDoubles ? "Looking for doubles" : null, availability.note]
              .filter(Boolean)
              .join(" · ")}
          </Text>
        ) : null}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Stop being open to play"
        hitSlop={6}
        onPress={onStop}
        style={styles.stopButton}
      >
        <Text style={styles.stop}>Stop</Text>
      </Pressable>
    </Pressable>
  )
}
