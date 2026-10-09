import { useId, useMemo, type ReactNode } from "react"
import { StyleSheet, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg"

import { liquidGlassPillBorderColor } from "@/components/ui/liquid-glass-chrome"
import {
  LiquidGlassSurface,
  liquidGlassFill,
} from "@/components/ui/liquid-glass-surface"
import { resolveColorScheme } from "@/constants/theme"
import { PlayTTSpacing } from "@/constants/playtt-tokens"
import { useColorScheme } from "@/hooks/use-color-scheme"

type ActivityStatsStickyChromeProps = {
  children: ReactNode
}

export function ActivityStatsStickyChrome({
  children,
}: ActivityStatsStickyChromeProps) {
  const insets = useSafeAreaInsets()
  const colorScheme = resolveColorScheme(useColorScheme())
  const gradientId = `stats-sticky-scrim-${useId().replace(/:/g, "")}`
  const scrimHeight = insets.top + 28

  const styles = useMemo(
    () =>
      StyleSheet.create({
        shell: {
          marginHorizontal: -20,
          overflow: "hidden",
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: liquidGlassPillBorderColor(colorScheme),
        },
        scrim: {
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: scrimHeight,
        },
        content: {
          gap: PlayTTSpacing.md,
          paddingHorizontal: 20,
          paddingTop: insets.top,
          paddingBottom: PlayTTSpacing.sm,
        },
      }),
    [colorScheme, insets.top, scrimHeight],
  )

  const scrimTop =
    colorScheme === "dark"
      ? "rgba(7, 17, 29, 0.92)"
      : "rgba(245, 247, 250, 0.94)"
  const scrimMid =
    colorScheme === "dark"
      ? "rgba(7, 17, 29, 0.45)"
      : "rgba(245, 247, 250, 0.55)"

  return (
    <View collapsable={false} style={styles.shell}>
      <LiquidGlassSurface colorScheme={colorScheme} style={liquidGlassFill} />
      <Svg pointerEvents="none" style={styles.scrim} width="100%" height={scrimHeight}>
        <Defs>
          <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={scrimTop} stopOpacity={1} />
            <Stop offset="0.55" stopColor={scrimMid} stopOpacity={1} />
            <Stop offset="1" stopColor={scrimMid} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#${gradientId})`} />
      </Svg>
      <View style={styles.content}>{children}</View>
    </View>
  )
}
