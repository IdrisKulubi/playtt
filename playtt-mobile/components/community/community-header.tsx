import { useMemo } from "react"
import { StyleSheet, Text, View } from "react-native"

import { PreviewBadge } from "@/components/ui/preview-badge"
import {
  PlayTTFontFamilies,
  PlayTTSpacing,
  PlayTTTypography,
} from "@/constants/playtt-tokens"
import { useProductTheme } from "@/hooks/use-product-theme"

export function CommunityHeader() {
  const theme = useProductTheme()

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: {
          gap: PlayTTSpacing.xs,
        },
        row: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: PlayTTSpacing.sm,
        },
        title: {
          ...PlayTTTypography.headline,
          fontSize: 26,
          lineHeight: 30,
          fontFamily: PlayTTFontFamilies.semiBold,
          color: theme.foreground,
          flex: 1,
        },
        subtitle: {
          fontSize: 15,
          fontFamily: PlayTTFontFamilies.regular,
          color: theme.muted,
          lineHeight: 22,
        },
      }),
    [theme],
  )

  return (
    <View style={styles.root}>
      <View style={styles.row}>
        <Text style={styles.title}>Community</Text>
        <PreviewBadge />
      </View>
      <Text style={styles.subtitle}>
        Find someone to play with at your venue.
      </Text>
    </View>
  )
}
