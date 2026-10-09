import * as Haptics from "expo-haptics"
import { type ReactNode, useMemo } from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"
import { IconSymbol } from "@/components/ui/icon-symbol"
import {
  PlayTTColors,
  PlayTTFontFamilies,
  PlayTTRadius,
  PlayTTSpacing,
} from "@/constants/playtt-tokens"
import { useProductTheme } from "@/hooks/use-product-theme"

type AccountGlassRowProps = {
  title: string
  subtitle?: string
  icon: ReactNode
  onPress?: () => void
  trailing?: ReactNode
  destructive?: boolean
  isLast?: boolean
  accessibilityHint?: string
}

export function AccountGlassRow({
  title,
  subtitle,
  icon,
  onPress,
  trailing,
  destructive = false,
  isLast = false,
  accessibilityHint,
}: AccountGlassRowProps) {
  const theme = useProductTheme()

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flexDirection: "row",
          alignItems: "center",
          gap: PlayTTSpacing.sm,
          minHeight: 80,
          paddingVertical: PlayTTSpacing.md,
          paddingHorizontal: PlayTTSpacing.md,
          borderBottomWidth: isLast ? 0 : StyleSheet.hairlineWidth,
          borderBottomColor: theme.border,
        },
        pressed: {
          opacity: 0.88,
        },
        iconWell: {
          width: 40,
          height: 40,
          borderRadius: PlayTTRadius.md,
          backgroundColor: theme.elevated,
          alignItems: "center",
          justifyContent: "center",
        },
        copy: {
          flex: 1,
          gap: 2,
          minWidth: 0,
        },
        title: {
          fontSize: 16,
          fontFamily: PlayTTFontFamilies.semiBold,
          color: theme.foreground,
        },
        subtitle: {
          fontSize: 13,
          fontFamily: PlayTTFontFamilies.regular,
          color: theme.muted,
          lineHeight: 18,
        },
        destructive: {
          color: PlayTTColors.productDestructive,
        },
        trailing: {
          flexDirection: "row",
          alignItems: "center",
          gap: PlayTTSpacing.xs,
        },
      }),
    [isLast, theme],
  )

  const content = (
    <>
      <View style={styles.iconWell}>{icon}</View>
      <View style={styles.copy}>
        <Text style={[styles.title, destructive && styles.destructive]}>
          {title}
        </Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      <View style={styles.trailing}>
        {trailing}
        {onPress && !trailing ? (
          <IconSymbol name="chevron.right" size={18} color={theme.muted} />
        ) : null}
      </View>
    </>
  )

  if (!onPress) {
    return <View style={styles.container}>{content}</View>
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint={accessibilityHint}
      onPress={onPress}
      onPressIn={() => {
        if (process.env.EXPO_OS === "ios") {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
        }
      }}
      style={({ pressed }) => [styles.container, pressed && styles.pressed]}
    >
      {content}
    </Pressable>
  )
}
