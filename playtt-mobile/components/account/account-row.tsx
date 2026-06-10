import { useMemo } from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"

import { IconSymbol } from "@/components/ui/icon-symbol"
import {
  PlayTTColors,
  PlayTTFontFamilies,
  PlayTTSpacing,
} from "@/constants/playtt-tokens"
import type { ProductThemeColors } from "@/constants/product-theme"
import { useProductTheme } from "@/hooks/use-product-theme"

type AccountRowProps = {
  title: string
  subtitle?: string
  value?: string
  onPress?: () => void
  showChevron?: boolean
  destructive?: boolean
  isLast?: boolean
  accessibilityHint?: string
}

function createStyles(theme: ProductThemeColors) {
  return StyleSheet.create({
    container: {
      paddingVertical: PlayTTSpacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
    },
    containerLast: {
      borderBottomWidth: 0,
      paddingBottom: 0,
    },
    pressed: {
      opacity: 0.7,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: PlayTTSpacing.sm,
    },
    copy: {
      flex: 1,
      gap: 2,
    },
    title: {
      fontSize: 16,
      fontFamily: PlayTTFontFamilies.medium,
      color: theme.foreground,
    },
    subtitle: {
      fontSize: 13,
      fontFamily: PlayTTFontFamilies.regular,
      color: theme.muted,
    },
    value: {
      fontSize: 13,
      fontFamily: PlayTTFontFamilies.regular,
      color: theme.muted,
      marginTop: 2,
    },
    destructive: {
      color: PlayTTColors.destructive,
    },
  })
}

export function AccountRow({
  title,
  subtitle,
  value,
  onPress,
  showChevron = Boolean(onPress),
  destructive = false,
  isLast = false,
  accessibilityHint,
}: AccountRowProps) {
  const theme = useProductTheme()
  const styles = useMemo(() => createStyles(theme), [theme])
  const containerStyle = [styles.container, isLast && styles.containerLast]

  const content = (
    <View style={styles.row}>
      <View style={styles.copy}>
        <Text style={[styles.title, destructive && styles.destructive]}>
          {title}
        </Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        {value ? <Text style={styles.value}>{value}</Text> : null}
      </View>
      {showChevron ? (
        <IconSymbol
          name="chevron.right"
          size={18}
          color={theme.muted}
        />
      ) : null}
    </View>
  )

  if (!onPress) {
    return <View style={containerStyle}>{content}</View>
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint={accessibilityHint}
      onPress={onPress}
      style={({ pressed }) => [
        ...containerStyle,
        pressed && styles.pressed,
      ]}
    >
      {content}
    </Pressable>
  )
}
