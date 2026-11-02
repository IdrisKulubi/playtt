import { StyleSheet, View } from "react-native"

import { PressableScale } from "@/components/kit/pressable-scale"
import { AppText } from "@/components/ui/app-text"
import { IconSymbol } from "@/components/ui/icon-symbol"
import { KitLayout } from "@/constants/kit-layout"
import { PlayTTSpacing } from "@/constants/playtt-tokens"
import { useAppTheme } from "@/hooks/use-app-theme"

type RadioListProps<T extends string> = {
  /** Read out as the group name, e.g. the question being answered. */
  label: string
  options: readonly { value: T; label: string }[]
  value: T | null
  onChange: (value: T) => void
}

/**
 * One big full-width button per answer, with a tick on the chosen one.
 * For questions where long answers would be cramped as chips.
 */
export function RadioList<T extends string>({ label, options, value, onChange }: RadioListProps<T>) {
  const { colors } = useAppTheme()

  return (
    <View style={styles.list} accessibilityRole="radiogroup" accessibilityLabel={label}>
      {options.map((option) => {
        const selected = option.value === value
        return (
          <PressableScale
            key={option.value}
            onPress={() => onChange(option.value)}
            haptic="selection"
            pressedScale={0.98}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            accessibilityLabel={option.label}
            style={[
              styles.row,
              {
                backgroundColor: selected ? colors.fill : colors.surface,
                borderColor: selected ? colors.accent : colors.separator,
              },
            ]}
          >
            <AppText variant="headline" style={styles.text}>
              {option.label}
            </AppText>
            <View
              style={[
                styles.radio,
                { borderColor: selected ? colors.accent : colors.tertiaryLabel },
                selected ? { backgroundColor: colors.accent } : null,
              ]}
            >
              {selected ? <IconSymbol name="checkmark" size={16} color={colors.onAccent} /> : null}
            </View>
          </PressableScale>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  list: { gap: PlayTTSpacing.xs },
  row: {
    minHeight: KitLayout.rowMinHeight,
    flexDirection: "row",
    alignItems: "center",
    gap: PlayTTSpacing.sm,
    paddingHorizontal: PlayTTSpacing.md,
    paddingVertical: PlayTTSpacing.sm,
    borderRadius: 14,
    borderCurve: "continuous",
    borderWidth: 1.5,
  },
  text: { flex: 1 },
  radio: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
})
