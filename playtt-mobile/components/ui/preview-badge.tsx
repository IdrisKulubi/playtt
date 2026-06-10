import { useMemo } from "react"
import { StyleSheet, Text, View } from "react-native"

import {
  PlayTTColors,
  PlayTTFontFamilies,
  PlayTTSpacing,
} from "@/constants/playtt-tokens"
import { useProductTheme } from "@/hooks/use-product-theme"

type PreviewBadgeProps = {
  label?: string
}

export function PreviewBadge({ label = "Preview" }: PreviewBadgeProps) {
  const theme = useProductTheme()
  const styles = useMemo(
    () =>
      StyleSheet.create({
        badge: {
          alignSelf: "flex-start",
          paddingHorizontal: PlayTTSpacing.sm,
          paddingVertical: 2,
          borderRadius: 999,
          backgroundColor: theme.elevated,
          borderWidth: 1,
          borderColor: theme.border,
        },
        label: {
          fontSize: 11,
          fontFamily: PlayTTFontFamilies.semiBold,
          color: PlayTTColors.primary,
          textTransform: "uppercase",
          letterSpacing: 0.4,
        },
      }),
    [theme.border, theme.elevated],
  )

  return (
    <View style={styles.badge}>
      <Text style={styles.label}>{label}</Text>
    </View>
  )
}
