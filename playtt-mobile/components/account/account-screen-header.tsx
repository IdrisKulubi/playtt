import { useMemo } from "react"
import { StyleSheet, Text, View } from "react-native"

import { ScreenBackButton } from "@/components/navigation/screen-back-button"
import {
  PlayTTFontFamilies,
  PlayTTSpacing,
} from "@/constants/playtt-tokens"
import type { ProductThemeColors } from "@/constants/product-theme"
import { useProductTheme } from "@/hooks/use-product-theme"

type AccountScreenHeaderProps = {
  title: string
}

function createStyles(theme: ProductThemeColors) {
  return StyleSheet.create({
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: PlayTTSpacing.lg,
      paddingTop: PlayTTSpacing.sm,
    },
    headerTitle: {
      fontSize: 16,
      fontFamily: PlayTTFontFamilies.semiBold,
      color: theme.foreground,
    },
    spacer: {
      width: 40,
    },
  })
}

export function AccountScreenHeader({ title }: AccountScreenHeaderProps) {
  const theme = useProductTheme()
  const styles = useMemo(() => createStyles(theme), [theme])

  return (
    <View style={styles.header}>
      <ScreenBackButton />
      <Text style={styles.headerTitle}>{title}</Text>
      <View style={styles.spacer} />
    </View>
  )
}
