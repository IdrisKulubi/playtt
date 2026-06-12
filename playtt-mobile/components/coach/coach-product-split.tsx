import { useMemo } from "react"
import { StyleSheet, Text, View } from "react-native"

import {
  PlayTTFontFamilies,
  PlayTTSpacing,
} from "@/constants/playtt-tokens"
import { useProductTheme } from "@/hooks/use-product-theme"

export function CoachProductSplit() {
  const theme = useProductTheme()

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: {
          gap: 0,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: theme.border,
          paddingTop: PlayTTSpacing.sm,
        },
        row: {
          paddingVertical: PlayTTSpacing.sm,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: theme.border,
          gap: 2,
        },
        label: {
          fontSize: 14,
          fontFamily: PlayTTFontFamilies.medium,
          color: theme.foreground,
        },
        body: {
          fontSize: 13,
          fontFamily: PlayTTFontFamilies.regular,
          color: theme.muted,
          lineHeight: 18,
        },
      }),
    [theme],
  )

  return (
    <View style={styles.root}>
      <View style={styles.row}>
        <Text style={styles.label}>Clip packs</Text>
        <Text style={styles.body}>
          Capture 30-second highlights when you press Replay at the venue.
        </Text>
      </View>
      <View style={[styles.row, { borderBottomWidth: 0 }]}>
        <Text style={styles.label}>Coach</Text>
        <Text style={styles.body}>
          Reviews your clips and suggests drills to practice. Sold separately.
        </Text>
      </View>
    </View>
  )
}
