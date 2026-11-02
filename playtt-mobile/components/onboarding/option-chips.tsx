import { StyleSheet, View } from "react-native"

import { PressableScale } from "@/components/kit/pressable-scale"
import { AppText } from "@/components/ui/app-text"
import { IconSymbol } from "@/components/ui/icon-symbol"
import type { AuthThemeColors } from "@/constants/auth-theme"
import type { ProductThemeColors } from "@/constants/product-theme"
import { PlayTTSpacing } from "@/constants/playtt-tokens"
import { useAppTheme } from "@/hooks/use-app-theme"

type OptionChip = {
  value: string
  label: string
}

type OptionChipsProps = {
  options: readonly OptionChip[]
  value: string | null
  onChange: (value: string) => void
  /** Sign-in screens pass their glass theme; everywhere else uses the app theme. */
  theme?: AuthThemeColors
  /** @deprecated Chips follow the app theme now. */
  productTheme?: ProductThemeColors
}

/** Short single-choice answers as big pills; the chosen one also gets a tick. */
export function OptionChips({ options, value, onChange, theme }: OptionChipsProps) {
  const { colors } = useAppTheme()
  const palette = theme
    ? {
        selectedBg: theme.primary,
        selectedFg: theme.primaryForeground,
        idleBg: theme.socialFill,
        idleFg: theme.foreground,
        border: theme.divider,
      }
    : {
        selectedBg: colors.accent,
        selectedFg: colors.onAccent,
        idleBg: colors.surface,
        idleFg: colors.label,
        border: colors.separator,
      }

  return (
    <View style={styles.wrap} accessibilityRole="radiogroup">
      {options.map((option) => {
        const selected = value === option.value

        return (
          <PressableScale
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            accessibilityLabel={option.label}
            haptic="selection"
            onPress={() => onChange(option.value)}
            style={[
              styles.chip,
              {
                backgroundColor: selected ? palette.selectedBg : palette.idleBg,
                borderColor: selected ? palette.selectedBg : palette.border,
              },
            ]}
          >
            {selected ? <IconSymbol name="checkmark" size={16} color={palette.selectedFg} /> : null}
            <AppText variant="callout" weight={selected ? "700" : "500"} style={{ color: selected ? palette.selectedFg : palette.idleFg }}>
              {option.label}
            </AppText>
          </PressableScale>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: PlayTTSpacing.xs,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: PlayTTSpacing["2xs"],
    borderWidth: 1,
    borderRadius: 24,
    paddingHorizontal: PlayTTSpacing.md,
  },
})
