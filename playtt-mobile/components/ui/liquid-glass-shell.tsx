import { type ReactNode } from "react"
import {
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native"

import type { AppColorScheme } from "@/constants/theme"
import { PlayTTRadius } from "@/constants/playtt-tokens"
import { getLiquidGlassShellSwift } from "@/lib/load-expo-ui"
import { type LiquidGlassVariant } from "@/lib/liquid-glass"

import {
  LiquidGlassFallback,
  liquidGlassFallbackFill,
} from "./liquid-glass-fallback"

type GlassShape = "rectangle" | "roundedRectangle"

type LiquidGlassShellProps = {
  colorScheme: AppColorScheme
  style?: StyleProp<ViewStyle>
  variant?: LiquidGlassVariant
  borderRadius?: number
  shape?: GlassShape
  spacing?: number
  blurIntensity?: number
  borderColor?: string
  showBorder?: boolean
  children?: ReactNode
  swiftUIContent?: ReactNode
}

export function LiquidGlassShell(props: LiquidGlassShellProps) {
  const SwiftShell = getLiquidGlassShellSwift()
  if (SwiftShell) {
    return <SwiftShell {...props} />
  }

  return <LiquidGlassShellFallback {...props} />
}

function LiquidGlassShellFallback({
  colorScheme,
  style,
  borderRadius = PlayTTRadius.panel,
  blurIntensity = 80,
  borderColor,
  showBorder = false,
  children,
  swiftUIContent,
}: LiquidGlassShellProps) {
  const resolvedBorderColor = borderColor ?? "transparent"

  return (
    <View
      style={[
        styles.shell,
        style,
        showBorder && {
          borderColor: resolvedBorderColor,
          borderWidth: StyleSheet.hairlineWidth,
        },
      ]}
    >
      <LiquidGlassFallback
        colorScheme={colorScheme}
        intensity={blurIntensity}
        style={[liquidGlassFallbackFill, { borderRadius }]}
      />
      {children}
      {swiftUIContent}
    </View>
  )
}

const styles = StyleSheet.create({
  shell: {
    overflow: "hidden",
  },
})
