import { useEffect, useId, useMemo, useState, type ReactNode } from "react"
import {
  AccessibilityInfo,
  Platform,
  StyleSheet,
  View,
} from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg"

import {
  LiquidGlassSurface,
  liquidGlassFill,
} from "@/components/ui/liquid-glass-surface"
import { resolveColorScheme } from "@/constants/theme"
import { PlayTTColors, PlayTTSpacing } from "@/constants/playtt-tokens"
import { useColorScheme } from "@/hooks/use-color-scheme"

type ActivityStatsStickyChromeProps = {
  children: ReactNode
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

export function ActivityStatsStickyChrome({
  children,
}: ActivityStatsStickyChromeProps) {
  const insets = useSafeAreaInsets()
  const colorScheme = resolveColorScheme(useColorScheme())
  const reduceTransparency = useReduceTransparency()
  const gradientId = `stats-sticky-scrim-${useId().replace(/:/g, "")}`

  const styles = useMemo(
    () =>
      StyleSheet.create({
        shell: {
          marginHorizontal: -20,
          marginTop: -insets.top,
        },
        backdrop: {
          ...StyleSheet.absoluteFill,
        },
        solidScrim: {
          ...StyleSheet.absoluteFill,
          backgroundColor:
            colorScheme === "dark"
              ? PlayTTColors.backgroundElevated
              : PlayTTColors.productCard,
        },
        content: {
          zIndex: 1,
          gap: PlayTTSpacing.md,
          paddingHorizontal: 20,
          paddingTop: insets.top,
          paddingBottom: PlayTTSpacing.sm,
        },
      }),
    [colorScheme, insets.top],
  )

  const scrimTop =
    colorScheme === "dark"
      ? "rgba(7, 17, 29, 0.94)"
      : "rgba(245, 247, 250, 0.96)"
  const scrimMid =
    colorScheme === "dark"
      ? "rgba(7, 17, 29, 0.78)"
      : "rgba(245, 247, 250, 0.82)"
  const scrimClear =
    colorScheme === "dark" ? "rgba(7, 17, 29, 0)" : "rgba(245, 247, 250, 0)"

  return (
    <View collapsable={false} style={styles.shell}>
      <View pointerEvents="none" style={styles.backdrop}>
        {reduceTransparency ? (
          <View style={styles.solidScrim} />
        ) : (
          <>
            <LiquidGlassSurface
              colorScheme={colorScheme}
              style={liquidGlassFill}
            />
            <Svg
              width="100%"
              height="100%"
              preserveAspectRatio="none"
              style={StyleSheet.absoluteFill}
            >
              <Defs>
                <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={scrimTop} stopOpacity={1} />
                  <Stop offset="0.4" stopColor={scrimMid} stopOpacity={0.92} />
                  <Stop offset="1" stopColor={scrimClear} stopOpacity={0} />
                </LinearGradient>
              </Defs>
              <Rect width="100%" height="100%" fill={`url(#${gradientId})`} />
            </Svg>
          </>
        )}
      </View>
      <View style={styles.content}>{children}</View>
    </View>
  )
}
