import { useMemo } from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"

import {
  PlayTTFontFamilies,
  PlayTTSpacing,
} from "@/constants/playtt-tokens"
import { useProductTheme } from "@/hooks/use-product-theme"

type SegmentControlProps<T extends string> = {
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
}

export function SegmentControl<T extends string>({
  value,
  options,
  onChange,
}: SegmentControlProps<T>) {
  const theme = useProductTheme()
  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: {
          flexDirection: "row",
          padding: 4,
          borderRadius: 12,
          backgroundColor: theme.elevated,
          borderWidth: 1,
          borderColor: theme.border,
          gap: 4,
        },
        segment: {
          flex: 1,
          paddingVertical: PlayTTSpacing.sm,
          borderRadius: 8,
          alignItems: "center",
        },
        segmentActive: {
          backgroundColor: theme.card,
        },
        label: {
          fontSize: 14,
          fontFamily: PlayTTFontFamilies.medium,
          color: theme.muted,
        },
        labelActive: {
          color: theme.foreground,
          fontFamily: PlayTTFontFamilies.semiBold,
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
            style={[styles.segment, active && styles.segmentActive]}
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
