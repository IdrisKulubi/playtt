import { router } from "expo-router"
import { useMemo } from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"

import {
  PlayTTColors,
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
    back: {
      fontSize: 14,
      fontFamily: PlayTTFontFamilies.semiBold,
      color: PlayTTColors.primary,
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
      <Pressable onPress={() => router.back()} hitSlop={8}>
        <Text style={styles.back}>Back</Text>
      </Pressable>
      <Text style={styles.headerTitle}>{title}</Text>
      <View style={styles.spacer} />
    </View>
  )
}
