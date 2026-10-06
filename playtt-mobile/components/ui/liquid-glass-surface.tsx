import { BlurView } from "expo-blur"
import {
  GlassView,
  isGlassEffectAPIAvailable,
  isLiquidGlassAvailable,
} from "expo-glass-effect"
import { useEffect, useState } from "react"
import {
  AccessibilityInfo,
  Platform,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native"

import type { AppColorScheme } from "@/constants/theme"
import { PlayTTColors } from "@/constants/playtt-tokens"

type LiquidGlassSurfaceProps = {
  colorScheme: AppColorScheme
  style?: StyleProp<ViewStyle>
}

function useReduceTransparency() {
  const [reduceTransparency, setReduceTransparency] = useState(false)

  useEffect(() => {
    if (Platform.OS !== "ios") return
    let mounted = true
    void AccessibilityInfo.isReduceTransparencyEnabled().then((enabled) => {
      if (mounted) setReduceTransparency(enabled)
    })
    const subscription = AccessibilityInfo.addEventListener(
      "reduceTransparencyChanged",
      setReduceTransparency,
    )
    return () => {
      mounted = false
      subscription.remove()
    }
  }, [])

  return reduceTransparency
}

function solidGlassFill(colorScheme: AppColorScheme) {
  return colorScheme === "dark"
    ? PlayTTColors.backgroundElevated
    : PlayTTColors.productCard
}

export function useNativeLiquidGlass() {
  return (
    Platform.OS === "ios" &&
    isLiquidGlassAvailable() &&
    isGlassEffectAPIAvailable()
  )
}

export function LiquidGlassSurface({
  colorScheme,
  style,
}: LiquidGlassSurfaceProps) {
  const reduceTransparency = useReduceTransparency()
  const nativeGlass = useNativeLiquidGlass()

  if (reduceTransparency) {
    return (
      <View
        pointerEvents="none"
        style={[style, { backgroundColor: solidGlassFill(colorScheme) }]}
      />
    )
  }

  if (nativeGlass) {
    return (
      <GlassView
        pointerEvents="none"
        style={style}
        glassEffectStyle="regular"
        colorScheme={colorScheme === "dark" ? "dark" : "light"}
      />
    )
  }

  if (Platform.OS === "ios") {
    return (
      <BlurView
        pointerEvents="none"
        intensity={72}
        tint={
          colorScheme === "dark"
            ? "systemChromeMaterialDark"
            : "systemChromeMaterialLight"
        }
        style={style}
      />
    )
  }

  return (
    <View pointerEvents="none" style={style}>
      <BlurView
        intensity={48}
        tint={colorScheme === "dark" ? "dark" : "light"}
        blurMethod="dimezisBlurViewSdk31Plus"
        style={StyleSheet.absoluteFill}
      />
      <View
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor:
              colorScheme === "dark"
                ? "rgba(7, 17, 29, 0.55)"
                : "rgba(255, 255, 255, 0.72)",
          },
        ]}
      />
    </View>
  )
}

export const liquidGlassFill = StyleSheet.absoluteFill
