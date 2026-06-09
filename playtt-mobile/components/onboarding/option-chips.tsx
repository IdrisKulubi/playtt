import { Pressable, StyleSheet, Text, View } from "react-native"

import type { AuthThemeColors } from "@/constants/auth-theme"
import {
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
  theme: AuthThemeColors
}

export function OptionChips({
  options,
  value,
  onChange,
  theme,
}: OptionChipsProps) {
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
                backgroundColor: selected ? theme.primary : theme.socialFill,
                borderColor: selected ? theme.primary : theme.divider,
              },
            ]}
          >
            <Text
              style={[
                styles.label,
                { color: selected ? theme.primaryForeground : theme.foreground },
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
