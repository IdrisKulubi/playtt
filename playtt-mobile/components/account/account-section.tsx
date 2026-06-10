import { ReactNode, useMemo } from "react"
import { StyleSheet, Text, View } from "react-native"

import {
  PlayTTFontFamilies,
  PlayTTSpacing,
} from "@/constants/playtt-tokens"
import type { ProductThemeColors } from "@/constants/product-theme"
import { useProductTheme } from "@/hooks/use-product-theme"

type AccountSectionProps = {
  title: string
  description?: string
  children?: ReactNode
}

function createStyles(theme: ProductThemeColors) {
  return StyleSheet.create({
    section: {
      gap: PlayTTSpacing.sm,
    },
    title: {
      fontSize: 12,
      fontFamily: PlayTTFontFamilies.semiBold,
      color: theme.muted,
      textTransform: "uppercase",
      letterSpacing: 0.6,
    },
    description: {
      fontSize: 13,
      fontFamily: PlayTTFontFamilies.regular,
      color: theme.muted,
      marginTop: -PlayTTSpacing.xs,
    },
    rows: {
      gap: 0,
    },
  })
}

export function AccountSection({
  title,
  description,
  children,
}: AccountSectionProps) {
  const theme = useProductTheme()
  const styles = useMemo(() => createStyles(theme), [theme])

  return (
    <View style={styles.section}>
      <Text style={styles.title}>{title}</Text>
      {description ? (
        <Text style={styles.description}>{description}</Text>
      ) : null}
      {children ? <View style={styles.rows}>{children}</View> : null}
    </View>
  )
}
