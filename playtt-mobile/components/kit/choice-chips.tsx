import { StyleSheet, View } from "react-native"

import { PressableScale } from "@/components/kit/pressable-scale"
import { AppText } from "@/components/ui/app-text"
import { PlayTTSpacing } from "@/constants/playtt-tokens"
import { useAppTheme } from "@/hooks/use-app-theme"

type ChoiceChipsProps<T extends string | number> = {
  /** Read out before each option, e.g. "Game length". */
  label: string
  options: { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
}

/** A few big, equal-width choices in a row. Selected = cyan fill plus bold label. */
export function ChoiceChips<T extends string | number>({ label, options, value, onChange }: ChoiceChipsProps<T>) {
  const { colors } = useAppTheme()

  return (
    <View style={styles.row} accessibilityRole="radiogroup" accessibilityLabel={label}>
      {options.map((option) => {
        const selected = option.value === value
        return (
          <PressableScale
            key={String(option.value)}
            onPress={() => onChange(option.value)}
            haptic="selection"
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            accessibilityLabel={option.label}
            style={[styles.chip, { backgroundColor: selected ? colors.accent : colors.surface }]}
          >
            <AppText variant="headline" weight={selected ? "700" : "500"} color={selected ? "onAccent" : "label"}>
              {option.label}
            </AppText>
          </PressableScale>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: PlayTTSpacing.xs },
  chip: {
    flex: 1,
    paddingVertical: PlayTTSpacing.sm,
    borderRadius: 14,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
  },
})
