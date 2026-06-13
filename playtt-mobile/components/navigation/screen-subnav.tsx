import { useMemo } from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"

import {
  PlayTTColors,
  PlayTTFontFamilies,
  PlayTTSpacing,
} from "@/constants/playtt-tokens"
import { useProductTheme } from "@/hooks/use-product-theme"

type ScreenSubnavOption<T extends string> = {
  value: T
  label: string
}

type ScreenSubnavProps<T extends string> = {
  value: T
  options: ScreenSubnavOption<T>[]
  onChange: (value: T) => void
}

export function ScreenSubnav<T extends string>({
  value,
  options,
  onChange,
}: ScreenSubnavProps<T>) {
  const theme = useProductTheme()

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: {
          flexDirection: "row",
          gap: PlayTTSpacing.lg,
          paddingHorizontal: PlayTTSpacing.xl,
          paddingTop: PlayTTSpacing.sm,
          paddingBottom: PlayTTSpacing.md,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: theme.border,
        },
        tab: {
          paddingBottom: PlayTTSpacing.sm,
          borderBottomWidth: 2,
          borderBottomColor: "transparent",
        },
        tabActive: {
          borderBottomColor: PlayTTColors.primary,
        },
        label: {
          fontSize: 17,
          fontFamily: PlayTTFontFamilies.medium,
          color: theme.muted,
        },
        labelActive: {
          fontFamily: PlayTTFontFamilies.semiBold,
          color: theme.foreground,
        },
      }),
    [theme],
  )

  return (
    <View style={styles.root}>
      {options.map((option) => {
        const active = option.value === value
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            style={[styles.tab, active && styles.tabActive]}
          >
            <Text style={[styles.label, active && styles.labelActive]}>
              {option.label}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}
