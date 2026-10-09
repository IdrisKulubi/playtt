import { Pressable, StyleSheet, Text, View } from "react-native"

import type { AuthThemeColors } from "@/constants/auth-theme"
import type { ProductThemeColors } from "@/constants/product-theme"
import {
  PlayTTColors,
  PlayTTFontFamilies,
  PlayTTRadius,
  PlayTTSpacing,
} from "@/constants/playtt-tokens"

type OptionChip = {
  value: string
  label: string
}

type OptionChipsProps = {
  options: readonly OptionChip[]
  value: string | null
  onChange: (value: string) => void
  theme?: AuthThemeColors
  productTheme?: ProductThemeColors
}

export function OptionChips({
  options,
  value,
  onChange,
  theme,
  productTheme,
}: OptionChipsProps) {
  const chipTheme = productTheme
    ? {
        selectedBg: PlayTTColors.primary,
        selectedFg: PlayTTColors.primaryForeground,
        idleBg: productTheme.elevated,
        idleFg: productTheme.foreground,
        border: productTheme.border,
        selectedBorder: PlayTTColors.primary,
      }
    : theme
      ? {
          selectedBg: theme.primary,
          selectedFg: theme.primaryForeground,
          idleBg: theme.socialFill,
          idleFg: theme.foreground,
          border: theme.divider,
          selectedBorder: theme.primary,
        }
      : null

  if (!chipTheme) {
    return null
  }

  return (
    <View style={styles.wrap}>
      {options.map((option) => {
        const selected = value === option.value

        return (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            style={[
              styles.chip,
              {
                backgroundColor: selected ? chipTheme.selectedBg : chipTheme.idleBg,
                borderColor: selected ? chipTheme.selectedBorder : chipTheme.border,
              },
            ]}
          >
            <Text
              style={[
                styles.label,
                {
                  color: selected ? chipTheme.selectedFg : chipTheme.idleFg,
                },
              ]}
            >
              {option.label}
            </Text>
          </Pressable>
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
    borderWidth: 1,
    borderRadius: PlayTTRadius.pill,
    paddingHorizontal: PlayTTSpacing.sm,
    paddingVertical: PlayTTSpacing.xs,
  },
  label: {
    fontSize: 13,
    fontFamily: PlayTTFontFamilies.medium,
  },
})
