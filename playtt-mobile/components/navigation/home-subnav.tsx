import { useMemo } from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"

import {
  PlayTTColors,
  PlayTTFontFamilies,
  PlayTTSpacing,
} from "@/constants/playtt-tokens"
import { useProductTheme } from "@/hooks/use-product-theme"

export type HomeTab = "play" | "coach"

type HomeSubnavProps = {
  value: HomeTab
  onChange: (value: HomeTab) => void
}

const TABS: { value: HomeTab; label: string }[] = [
  { value: "play", label: "Play" },
  { value: "coach", label: "Coach" },
]

export function HomeSubnav({ value, onChange }: HomeSubnavProps) {
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
      {TABS.map((tab) => {
        const active = tab.value === value
        return (
          <Pressable
            key={tab.value}
            onPress={() => onChange(tab.value)}
            style={[styles.tab, active && styles.tabActive]}
          >
            <Text style={[styles.label, active && styles.labelActive]}>
              {tab.label}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}
