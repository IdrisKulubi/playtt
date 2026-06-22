import {
  GlassEffectContainer,
  Host,
  HStack,
  Spacer,
} from "@expo/ui/swift-ui"
import { frame, glassEffect } from "@expo/ui/swift-ui/modifiers"
import { type ReactNode } from "react"
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native"

import type { AppColorScheme } from "@/constants/theme"
import { PlayTTRadius } from "@/constants/playtt-tokens"
import { glassVariantForScheme, type LiquidGlassVariant } from "@/lib/liquid-glass"

import { liquidGlassFallbackFill } from "./liquid-glass-fallback"

type GlassShape = "rectangle" | "roundedRectangle"

type LiquidGlassShellSwiftProps = {
  colorScheme: AppColorScheme
  style?: StyleProp<ViewStyle>
  variant?: LiquidGlassVariant
  borderRadius?: number
  shape?: GlassShape
  spacing?: number
  borderColor?: string
  showBorder?: boolean
  children?: ReactNode
  swiftUIContent?: ReactNode
}

export function LiquidGlassShellSwift({
  colorScheme,
  style,
  variant,
  borderRadius = PlayTTRadius.panel,
  shape = "roundedRectangle",
  spacing = 8,
  borderColor,
  showBorder = false,
  children,
  swiftUIContent,
}: LiquidGlassShellSwiftProps) {
  const glassVariant = variant ?? glassVariantForScheme(colorScheme)
  const resolvedBorderColor = borderColor ?? "transparent"

  return (
    <View
      style={[
        styles.shell,
        style,
        showBorder && {
          borderColor: resolvedBorderColor,
          borderWidth: StyleSheet.hairlineWidth,
          borderRadius,
          overflow: "hidden",
        },
      ]}
    >
      <Host
        style={liquidGlassFallbackFill}
        colorScheme={colorScheme}
        useViewportSizeMeasurement
      >
        <GlassEffectContainer spacing={spacing}>
          <HStack
            modifiers={[
              frame({ maxWidth: 10000, maxHeight: 10000 }),
              glassEffect({
                glass: { variant: glassVariant },
                shape,
                cornerRadius: shape === "roundedRectangle" ? borderRadius : undefined,
              }),
            ]}
          >
            <Spacer />
          </HStack>
        </GlassEffectContainer>
      </Host>
      {swiftUIContent ? (
        <Host style={liquidGlassFallbackFill} colorScheme={colorScheme} matchContents>
          {swiftUIContent}
        </Host>
      ) : null}
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  shell: {
    overflow: "hidden",
  },
})
