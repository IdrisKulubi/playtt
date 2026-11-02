import type { ReactNode } from "react"
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native"

import { PressableScale } from "@/components/kit/pressable-scale"
import { KitLayout } from "@/constants/kit-layout"
import { PlayTTSpacing } from "@/constants/playtt-tokens"
import { useAppTheme } from "@/hooks/use-app-theme"

type CardProps = {
  children: ReactNode
  /** Makes the whole card one tap target. Give it an accessibilityLabel. */
  onPress?: () => void
  accessibilityLabel?: string
  accessibilityHint?: string
  style?: StyleProp<ViewStyle>
}

/** Solid content surface. Glass is for floating chrome only, never cards. */
export function Card({ children, onPress, accessibilityLabel, accessibilityHint, style }: CardProps) {
  const { scheme, colors } = useAppTheme()
  const surface = [
    styles.card,
    { backgroundColor: colors.surface },
    scheme === "dark" ? styles.darkEdge : styles.lightShadow,
    scheme === "dark" ? { borderColor: colors.separator } : null,
    style,
  ]

  if (!onPress) return <View style={surface}>{children}</View>

  return (
    <PressableScale
      onPress={onPress}
      pressedScale={0.98}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      style={surface}
    >
      {children}
    </PressableScale>
  )
}

const styles = StyleSheet.create({
  card: {
    borderRadius: KitLayout.cardRadius,
    padding: PlayTTSpacing.md,
    borderCurve: "continuous",
  },
  lightShadow: {
    shadowColor: "#0A1628",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 2,
  },
  // Shadows vanish on dark backgrounds; a hairline edge separates instead.
  darkEdge: { borderWidth: StyleSheet.hairlineWidth },
})
