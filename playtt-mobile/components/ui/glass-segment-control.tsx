import { useMemo } from "react"
import { Platform, Pressable, StyleSheet, Text, View } from "react-native"

import {
  liquidGlassLabelColor,
  liquidGlassPillBorderColor,
  liquidGlassSelectionChipColor,
} from "@/components/ui/liquid-glass-chrome"
import {
  LiquidGlassSurface,
  liquidGlassFill,
  useNativeLiquidGlass,
} from "@/components/ui/liquid-glass-surface"
import { resolveColorScheme } from "@/constants/theme"
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
  const nativeGlass = useNativeLiquidGlass()

  const styles = useMemo(
    () =>
      StyleSheet.create({
        pill: {
          borderRadius: PlayTTRadius.pill,
          overflow: "hidden",
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: liquidGlassPillBorderColor(colorScheme),
          ...(!nativeGlass
            ? Platform.select({
                ios: {
                  shadowColor: colorScheme === "dark" ? "#000000" : "#0a1628",
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: colorScheme === "dark" ? 0.25 : 0.08,
                  shadowRadius: 12,
                },
                android: {
                  elevation: 6,
                },
                default: {},
              })
            : {}),
        },
        row: {
          flexDirection: "row",
          padding: 4,
          gap: 2,
          minHeight: 40,
        },
        segment: {
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
        },
        chip: {
          width: "100%",
          paddingVertical: 8,
          paddingHorizontal: 8,
          borderRadius: PlayTTRadius.pill,
          alignItems: "center",
          justifyContent: "center",
        },
        chipActive: {
          backgroundColor: liquidGlassSelectionChipColor(colorScheme),
        },
        label: {
          fontSize: 13,
          fontFamily: PlayTTFontFamilies.medium,
        },
        labelActive: {
          fontFamily: PlayTTFontFamilies.semiBold,
        },
      }),
    [colorScheme, nativeGlass],
  )

  return (
    <View style={styles.pill}>
      <LiquidGlassSurface colorScheme={colorScheme} style={liquidGlassFill} />

      <View style={styles.row}>
        {options.map((option) => {
          const active = option.value === value
          const labelColor = liquidGlassLabelColor(colorScheme, active)
          return (
            <Pressable
              key={option.value}
              onPress={() => onChange(option.value)}
              style={styles.segment}
            >
              <View style={[styles.chip, active && styles.chipActive]}>
                <Text
                  style={[
                    styles.label,
                    active && styles.labelActive,
                    { color: labelColor },
                  ]}
                >
                  {option.label}
                </Text>
              </View>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}
