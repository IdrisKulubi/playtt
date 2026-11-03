import { useEffect } from "react"
import { StyleSheet, View } from "react-native"
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
} from "react-native-reanimated"

import { spring } from "@/constants/motion"
import { useAppTheme } from "@/hooks/use-app-theme"

type MiniBarsProps = {
  values: number[]
  color: string
  height?: number
}

function Bar({ ratio, color, height, index }: { ratio: number; color: string; height: number; index: number }) {
  const reducedMotion = useReducedMotion()
  const grow = useSharedValue(reducedMotion ? 1 : 0)

  useEffect(() => {
    if (reducedMotion) return
    // Bars rise left to right, a few milliseconds apart.
    grow.set(withDelay(Math.min(index * 14, 420), withSpring(1, spring("default"))))
  }, [grow, index, reducedMotion])

  const style = useAnimatedStyle(() => ({ transform: [{ scaleY: grow.get() }] }))

  return (
    <Animated.View
      style={[styles.bar, { height: Math.max(3, ratio * height), backgroundColor: color, opacity: ratio ? 1 : 0.28 }, style]}
    />
  )
}

/**
 * A tiny chart for a summary tile: one thin bar per day, rising in from the
 * left, on a dotted baseline. Days with nothing are short grey stubs.
 */
export function MiniBars({ values, color, height = 56 }: MiniBarsProps) {
  const { colors } = useAppTheme()
  const max = Math.max(...values, 1)

  return (
    <View
      style={{ height }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View style={styles.bars}>
        {values.map((value, index) => (
          <Bar key={index} ratio={value / max} color={value ? color : colors.secondaryLabel} height={height} index={index} />
        ))}
      </View>
      <View style={[styles.baseline, { borderColor: colors.separator }]} />
    </View>
  )
}

const styles = StyleSheet.create({
  bars: { flex: 1, flexDirection: "row", alignItems: "flex-end", gap: 2 },
  bar: { flex: 1, borderRadius: 2, transformOrigin: "bottom" },
  baseline: { borderTopWidth: 1, borderStyle: "dotted", marginTop: 2 },
})
