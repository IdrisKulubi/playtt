import type { ReactNode } from "react"
import { ActivityIndicator, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native"

import { PressableScale } from "@/components/kit/pressable-scale"
import { AppText } from "@/components/ui/app-text"
import type { ColorRoles } from "@/constants/colors"
import { KitLayout } from "@/constants/kit-layout"
import { PlayTTSpacing } from "@/constants/playtt-tokens"
import { useAppTheme } from "@/hooks/use-app-theme"

export type KitButtonVariant = "primary" | "secondary" | "plain" | "destructive"

type KitButtonProps = {
  label: string
  onPress: () => void
  /** One `primary` per screen. */
  variant?: KitButtonVariant
  icon?: ReactNode
  loading?: boolean
  disabled?: boolean
  /** Stretch to the container width (default) or hug the label. */
  fullWidth?: boolean
  accessibilityHint?: string
  /** When the visible label needs context to make sense when read aloud. */
  accessibilityLabel?: string
  style?: StyleProp<ViewStyle>
}

function variantColors(variant: KitButtonVariant, colors: ColorRoles) {
  switch (variant) {
    case "primary":
      return { background: colors.accent, text: "onAccent" as const }
    case "secondary":
      return { background: colors.fill, text: "accentText" as const }
    case "plain":
      return { background: "transparent", text: "accentText" as const }
    case "destructive":
      return { background: colors.fill, text: "destructive" as const }
  }
}

export function Button({
  label,
  onPress,
  variant = "primary",
  icon,
  loading = false,
  disabled = false,
  fullWidth = true,
  accessibilityHint,
  accessibilityLabel,
  style,
}: KitButtonProps) {
  const { colors } = useAppTheme()
  const { background, text } = variantColors(variant, colors)

  return (
    <PressableScale
      // Loading blocks presses without dimming the button.
      onPress={loading ? undefined : onPress}
      disabled={disabled}
      haptic={variant === "plain" ? undefined : "commit"}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ busy: loading }}
      style={[
        styles.base,
        { backgroundColor: background },
        fullWidth ? styles.fullWidth : styles.hug,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={colors[text]} />
      ) : (
        <View style={styles.content}>
          {icon}
          <AppText variant="headline" color={text} numberOfLines={2} style={styles.label}>
            {label}
          </AppText>
        </View>
      )}
    </PressableScale>
  )
}

const styles = StyleSheet.create({
  base: {
    minHeight: KitLayout.buttonHeight,
    borderRadius: KitLayout.buttonHeight / 2,
    paddingHorizontal: PlayTTSpacing.lg,
    paddingVertical: PlayTTSpacing.xs,
    alignItems: "center",
    justifyContent: "center",
  },
  fullWidth: { alignSelf: "stretch" },
  hug: { alignSelf: "flex-start" },
  content: {
    flexDirection: "row",
    alignItems: "center",
    gap: PlayTTSpacing.xs,
  },
  label: { textAlign: "center" },
})
