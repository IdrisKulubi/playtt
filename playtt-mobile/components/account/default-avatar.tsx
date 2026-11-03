import { StyleSheet, View } from "react-native"
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from "react-native-svg"

import { useAppTheme } from "@/hooks/use-app-theme"

/** Sky-blue backdrop that matches PlayTT's cyan without shouting. */
/** Plain id: generated ones contain characters that break url(#id) lookups. */
const GRADIENT_ID = "playtt-default-avatar"

const PALETTE = {
  light: { top: "#C9EDFB", bottom: "#8FD3EF", figure: "#FFFFFF" },
  dark: { top: "#3B5A75", bottom: "#24384D", figure: "#B9D4E8" },
} as const

/**
 * The picture for players with no photo (none uploaded, none from Google
 * or Apple): one friendly head-and-shoulders figure that suits everyone,
 * drawn with plain shapes so it always renders, even offline.
 */
export function DefaultAvatar({ size }: { size?: number }) {
  const { scheme } = useAppTheme()
  const colors = PALETTE[scheme]

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      // No size: fill the parent (it must be square), e.g. inside a card ring.
      style={[styles.circle, size ? { width: size, height: size } : styles.fill]}
    >
      <Svg width={size ?? "100%"} height={size ?? "100%"} viewBox="0 0 100 100">
        <Defs>
          <LinearGradient id={GRADIENT_ID} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.top} />
            <Stop offset="1" stopColor={colors.bottom} />
          </LinearGradient>
        </Defs>
        <Circle cx="50" cy="50" r="50" fill={`url(#${GRADIENT_ID})`} />
        {/* Head */}
        <Circle cx="50" cy="40" r="17" fill={colors.figure} />
        {/* Shoulders, running off the bottom edge */}
        <Path d="M16 100 C16 76 31 64 50 64 C69 64 84 76 84 100 Z" fill={colors.figure} />
      </Svg>
    </View>
  )
}

const styles = StyleSheet.create({
  circle: { overflow: "hidden", borderRadius: 999 },
  fill: { width: "100%", height: "100%" },
})
