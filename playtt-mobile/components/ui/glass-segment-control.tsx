import { type ComponentType, useMemo } from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"

import {
  LiquidGlassFallback,
  liquidGlassFallbackFill,
} from "@/components/ui/liquid-glass-fallback"
import { Colors, resolveColorScheme } from "@/constants/theme"
import { ProductThemes } from "@/constants/product-theme"
import {
  PlayTTFontFamilies,
  PlayTTRadius,
} from "@/constants/playtt-tokens"
import { useColorScheme } from "@/hooks/use-color-scheme"
import { getGlassSegmentControlSwift } from "@/lib/load-expo-ui"

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
  const SwiftSegmentControl = getGlassSegmentControlSwift()
  if (SwiftSegmentControl) {
    const Segment = SwiftSegmentControl as unknown as ComponentType<
      GlassSegmentControlProps<T>
    >
    return <Segment value={value} options={options} onChange={onChange} />
  }

  return (
    <GlassSegmentControlFallback
      value={value}
      options={options}
      onChange={onChange}
    />
  )
}

function GlassSegmentControlFallback<T extends string>({
  value,
  options,
  onChange,
}: GlassSegmentControlProps<T>) {
  const colorScheme = resolveColorScheme(useColorScheme())
  const productTheme = ProductThemes[colorScheme]
  const palette = Colors[colorScheme]

  const styles = useMemo(
    () =>
      StyleSheet.create({
        pill: {
          borderRadius: PlayTTRadius.lg,
          overflow: "hidden",
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: productTheme.border,
        },
        row: {
          flexDirection: "row",
          padding: 3,
          gap: 2,
        },
        segment: {
          flex: 1,
          paddingVertical: 6,
          paddingHorizontal: 4,
          borderRadius: PlayTTRadius.md,
          alignItems: "center",
          justifyContent: "center",
        },
        segmentActive: {
          backgroundColor:
            colorScheme === "dark"
              ? "rgba(255, 255, 255, 0.1)"
              : "rgba(10, 22, 40, 0.08)",
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
    [colorScheme, palette.tabIconDefault, palette.tabIconSelected, productTheme.border],
  )

  return (
    <View style={styles.pill}>
      <LiquidGlassFallback
        colorScheme={colorScheme}
        intensity={64}
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
