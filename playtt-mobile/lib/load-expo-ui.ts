import type { BottomTabBarProps } from "@react-navigation/bottom-tabs"
import type { ComponentType, ReactNode } from "react"

import { canUseLiquidGlass } from "@/lib/liquid-glass"

type GlassSegmentControlProps<T extends string> = {
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
}

type LiquidGlassShellProps = {
  colorScheme: import("@/constants/theme").AppColorScheme
  style?: import("react-native").StyleProp<import("react-native").ViewStyle>
  variant?: import("@/lib/liquid-glass").LiquidGlassVariant
  borderRadius?: number
  shape?: "rectangle" | "roundedRectangle"
  spacing?: number
  blurIntensity?: number
  borderColor?: string
  showBorder?: boolean
  children?: ReactNode
  swiftUIContent?: ReactNode
}

let glassTabBarSwift: ComponentType<BottomTabBarProps> | null = null
let glassSegmentControlSwift: ComponentType<GlassSegmentControlProps<string>> | null =
  null
let liquidGlassShellSwift: ComponentType<LiquidGlassShellProps> | null = null

export function getGlassTabBarSwift(): ComponentType<BottomTabBarProps> | null {
  if (!canUseLiquidGlass()) {
    return null
  }

  if (!glassTabBarSwift) {
    glassTabBarSwift = require("@/components/navigation/glass-tab-bar-swift")
      .GlassTabBarSwift
  }

  return glassTabBarSwift
}

export function getGlassSegmentControlSwift(): ComponentType<
  GlassSegmentControlProps<string>
> | null {
  if (!canUseLiquidGlass()) {
    return null
  }

  if (!glassSegmentControlSwift) {
    glassSegmentControlSwift = require("@/components/ui/glass-segment-control-swift")
      .GlassSegmentControlSwift
  }

  return glassSegmentControlSwift
}

export function getLiquidGlassShellSwift(): ComponentType<LiquidGlassShellProps> | null {
  if (!canUseLiquidGlass()) {
    return null
  }

  if (!liquidGlassShellSwift) {
    liquidGlassShellSwift = require("@/components/ui/liquid-glass-shell-swift")
      .LiquidGlassShellSwift
  }

  return liquidGlassShellSwift
}
