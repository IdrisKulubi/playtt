import { BlurView } from "expo-blur"
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native"

import type { AppColorScheme } from "@/constants/theme"

type LiquidGlassFallbackProps = {
  colorScheme: AppColorScheme
  style?: StyleProp<ViewStyle>
  intensity?: number
}

export function LiquidGlassFallback({
  colorScheme,
  style,
  intensity = 80,
}: LiquidGlassFallbackProps) {
  if (Platform.OS === "ios") {
    return (
      <BlurView
        intensity={intensity}
        tint={colorScheme === "dark" ? "dark" : "light"}
        style={style}
      />
    )
  }

  return (
    <View
      style={[
        style,
        {
          backgroundColor:
            colorScheme === "dark"
              ? "rgba(16, 27, 43, 0.94)"
              : "rgba(255, 255, 255, 0.94)",
        },
      ]}
    />
  )
}

export const liquidGlassFallbackFill = StyleSheet.absoluteFillObject
