import { useMemo } from "react"
import { StyleSheet, Text, View } from "react-native"

import { PreviewBadge } from "@/components/ui/preview-badge"
import {
  PlayTTFontFamilies,
  PlayTTSpacing,
} from "@/constants/playtt-tokens"
import { useProductTheme } from "@/hooks/use-product-theme"

export function BookingPastSessionCard() {
  const theme = useProductTheme()
  const styles = useMemo(
    () =>
      StyleSheet.create({
        card: {
          gap: PlayTTSpacing.xs,
          borderWidth: 1,
          borderColor: theme.border,
          borderRadius: 12,
          padding: PlayTTSpacing.md,
          backgroundColor: theme.elevated,
        },
        header: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        },
        title: {
          fontSize: 14,
          fontFamily: PlayTTFontFamilies.semiBold,
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
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>Session replay</Text>
        <PreviewBadge label="Sample" />
      </View>
      <Text style={styles.body}>
        Replays from your sessions will show up in Activity when cameras are
        connected.
      </Text>
    </View>
  )
}
