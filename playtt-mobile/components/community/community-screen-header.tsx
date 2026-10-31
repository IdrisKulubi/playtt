import type { ReactNode } from "react"
import { StyleSheet, Text, View } from "react-native"

import { ScreenBackButton } from "@/components/navigation/screen-back-button"
import { PlayTTFontFamilies, PlayTTSpacing, PlayTTTypography } from "@/constants/playtt-tokens"
import { useProductTheme } from "@/hooks/use-product-theme"

/** Back button, centered title and an optional trailing action. */
export function CommunityScreenHeader({ title, trailing }: { title: string; trailing?: ReactNode }) {
  const theme = useProductTheme()

  return (
    <View style={styles.header}>
      <ScreenBackButton />
      <Text
        numberOfLines={1}
        accessibilityRole="header"
        style={[styles.title, { color: theme.foreground }]}
      >
        {title}
      </Text>
      <View style={styles.trailing}>{trailing}</View>
    </View>
  )
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: PlayTTSpacing.sm,
    paddingHorizontal: 20,
    paddingTop: PlayTTSpacing.sm,
    paddingBottom: PlayTTSpacing.md,
  },
  title: {
    ...PlayTTTypography.title,
    fontFamily: PlayTTFontFamilies.semiBold,
    flex: 1,
    textAlign: "center",
  },
  trailing: {
    minWidth: 40,
    alignItems: "flex-end",
  },
})
