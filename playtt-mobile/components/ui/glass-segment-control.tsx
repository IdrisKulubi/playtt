import { useMemo } from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"

import {
  LiquidGlassFallback,
  liquidGlassFallbackFill,
} from "@/components/ui/liquid-glass-fallback"
import { Colors, resolveColorScheme } from "@/constants/theme"
import {
  PlayTTFontFamilies,
  PlayTTRadius,
} from "@/constants/playtt-tokens"
import { useColorScheme } from "@/hooks/use-color-scheme"

type GlassSegmentControlProps<T extends string> = {
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
}

export function GlassSegmentControl<T extends string>({
  value,
  options,
  onChange,
}: GlassSegmentControlProps<T>) {
  const colorScheme = resolveColorScheme(useColorScheme())
  const palette = Colors[colorScheme]

  const styles = useMemo(
    () =>
      StyleSheet.create({
        pill: {
          borderRadius: PlayTTRadius.pill,
          overflow: "hidden",
          borderWidth: StyleSheet.hairlineWidth,
          borderColor:
            colorScheme === "dark"
              ? "rgba(255, 255, 255, 0.12)"
              : "rgba(10, 22, 40, 0.08)",
        },
        row: {
          flexDirection: "row",
          padding: 3,
          gap: 2,
          minHeight: 32,
        },
        segment: {
          flex: 1,
          paddingVertical: 5,
          paddingHorizontal: 6,
          borderRadius: PlayTTRadius.pill,
          alignItems: "center",
          justifyContent: "center",
        },
        segmentActive: {
          backgroundColor:
            colorScheme === "dark"
              ? "rgba(255, 255, 255, 0.14)"
              : "rgba(10, 22, 40, 0.1)",
        },
        label: {
          fontSize: 12,
          fontFamily: PlayTTFontFamilies.medium,
          color: palette.tabIconDefault,
        },
        labelActive: {
          fontFamily: PlayTTFontFamilies.semiBold,
          color: palette.tabIconSelected,
        },
      }),
    [colorScheme, palette.tabIconDefault, palette.tabIconSelected],
  )

  return (
    <View style={styles.pill}>
      <LiquidGlassFallback
        colorScheme={colorScheme}
        intensity={80}
        style={liquidGlassFallbackFill}
      />

      <View style={styles.row}>
        {options.map((option) => {
          const active = option.value === value
          return (
            <Pressable
              key={option.value}
              onPress={() => onChange(option.value)}
              style={[styles.segment, active && styles.segmentActive]}
            >
              <Text style={[styles.label, active && styles.labelActive]}>
                {option.label}
              </Text>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}
