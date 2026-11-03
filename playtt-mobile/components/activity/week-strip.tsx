import { StyleSheet, View } from "react-native"

import { ActivityRing } from "@/components/activity/activity-ring"
import { PressableScale } from "@/components/kit/pressable-scale"
import { AppText } from "@/components/ui/app-text"
import type { WeekDay } from "@/hooks/use-progress-summary"
import { useAppTheme } from "@/hooks/use-app-theme"
import { parseDate, timeLabel } from "@/lib/stats-dates"

/** One hour at the table closes a day's ring. */
export const DAY_RING_MINUTES = 60

type WeekStripProps = {
  days: WeekDay[]
  /** Highlighted day; leave unset for a read-only strip. */
  selectedKey?: string
  onSelect?: (key: string) => void
  ringSize?: number
}

function dayLabel(day: WeekDay) {
  const date = parseDate(day.key).toLocaleDateString("en-KE", { weekday: "long", day: "numeric", month: "long" })
  if (day.isFuture) return date
  return `${date}, ${day.minutes ? `${timeLabel(day.minutes)} at the table` : "no games"}`
}

/**
 * Seven days as small rings, like the week row at the top of Apple's Fitness.
 * Each ring closes at an hour of table time; the selected day gets a filled
 * letter, and today's letter is in colour.
 */
export function WeekStrip({ days, selectedKey, onSelect, ringSize = 38 }: WeekStripProps) {
  const { colors } = useAppTheme()

  return (
    <View style={styles.row} accessibilityRole="summary">
      {days.map((day, index) => {
        const selected = day.key === selectedKey
        const body = (
          <View style={styles.day}>
            <View style={[styles.letter, selected && { backgroundColor: colors.accent }]}>
              <AppText
                variant="footnote"
                weight={selected || day.isToday ? "700" : "600"}
                color={selected ? "onAccent" : day.isToday ? "accentText" : "secondaryLabel"}
                maxFontSizeMultiplier={1.3}
              >
                {day.initial}
              </AppText>
            </View>
            <ActivityRing
              size={ringSize}
              lineWidth={ringSize / 5}
              progress={day.isFuture ? 0 : day.minutes / DAY_RING_MINUTES}
              color={colors.accent}
              overlapColor={colors.accentText}
              showCap={false}
              delayMs={index * 70}
            />
          </View>
        )

        return onSelect ? (
          <PressableScale
            key={day.key}
            onPress={() => onSelect(day.key)}
            haptic="selection"
            accessibilityLabel={dayLabel(day)}
            accessibilityState={{ selected }}
            style={styles.cell}
          >
            {body}
          </PressableScale>
        ) : (
          <View key={day.key} style={styles.cell} accessible accessibilityLabel={dayLabel(day)}>
            {body}
          </View>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "space-between" },
  cell: { flex: 1, alignItems: "center", minHeight: 48 },
  day: { alignItems: "center", gap: 6 },
  letter: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
})
