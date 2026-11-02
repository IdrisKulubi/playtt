import { ScrollView, StyleSheet } from "react-native"

import { PressableScale } from "@/components/kit/pressable-scale"
import { AppText } from "@/components/ui/app-text"
import { KitLayout } from "@/constants/kit-layout"
import { PlayTTSpacing } from "@/constants/playtt-tokens"
import { useAppTheme } from "@/hooks/use-app-theme"
import { formatDateChipLabel, toDateKey } from "@/lib/booking-utils"

type DateStripProps = {
  days: Date[]
  selectedDate: string
  onChange: (dateKey: string) => void
}

/** Horizontal day picker, today first, like the Calendar app's week strip. */
export function DateStrip({ days, selectedDate, onChange }: DateStripProps) {
  const { colors } = useAppTheme()

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      // Bleed to the screen edges so the strip scrolls under the gutter.
      style={styles.bleed}
    >
      {days.map((day) => {
        const key = toDateKey(day)
        const selected = key === selectedDate
        const fullDate = day.toLocaleDateString("en-KE", { weekday: "long", day: "numeric", month: "long" })

        return (
          <PressableScale
            key={key}
            onPress={() => onChange(key)}
            haptic="selection"
            accessibilityLabel={fullDate}
            accessibilityState={{ selected }}
            style={[
              styles.chip,
              { backgroundColor: selected ? colors.accent : colors.surface },
            ]}
          >
            <AppText variant="footnote" weight="600" color={selected ? "onAccent" : "secondaryLabel"} maxFontSizeMultiplier={1.4}>
              {formatDateChipLabel(day)}
            </AppText>
            <AppText variant="title2" tabular color={selected ? "onAccent" : "label"} maxFontSizeMultiplier={1.4}>
              {day.getDate()}
            </AppText>
          </PressableScale>
        )
      })}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  bleed: { marginHorizontal: -KitLayout.screenGutter },
  row: {
    gap: PlayTTSpacing.xs,
    paddingHorizontal: KitLayout.screenGutter,
  },
  chip: {
    minWidth: 72,
    paddingVertical: PlayTTSpacing.sm,
    paddingHorizontal: PlayTTSpacing.sm,
    borderRadius: 16,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
})
