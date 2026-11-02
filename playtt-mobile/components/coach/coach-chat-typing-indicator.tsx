import { useEffect, useState } from "react"
import { Animated, StyleSheet, View } from "react-native"
import { useReducedMotion } from "react-native-reanimated"

import { AppText } from "@/components/ui/app-text"
import { KitLayout } from "@/constants/kit-layout"
import { PlayTTSpacing } from "@/constants/playtt-tokens"
import { useAppTheme } from "@/hooks/use-app-theme"

const DOT_REST = 0.35

/** "Coach is typing" with three pulsing dots; the dots hold still under Reduce Motion. */
export function CoachChatTypingIndicator() {
  const { colors } = useAppTheme()
  const reduceMotion = useReducedMotion()
  // Created once; a lazy state initializer keeps render free of ref reads.
  const [[dotOne, dotTwo, dotThree]] = useState(() => [
    new Animated.Value(DOT_REST),
    new Animated.Value(DOT_REST),
    new Animated.Value(DOT_REST),
  ])

  useEffect(() => {
    if (reduceMotion) return

    const animateDot = (value: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(value, { toValue: 1, duration: 320, useNativeDriver: true }),
          Animated.timing(value, { toValue: DOT_REST, duration: 320, useNativeDriver: true }),
        ]),
      )

    const animations = [animateDot(dotOne, 0), animateDot(dotTwo, 120), animateDot(dotThree, 240)]
    animations.forEach((animation) => animation.start())

    return () => {
      animations.forEach((animation) => animation.stop())
    }
  }, [dotOne, dotTwo, dotThree, reduceMotion])

  return (
    <View style={styles.row} accessibilityLiveRegion="polite">
      <View style={[styles.bubble, { backgroundColor: colors.surface, borderColor: colors.separator }]}>
        <AppText variant="subheadline" color="secondaryLabel">
          Coach is typing
        </AppText>
        <View style={styles.dots} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {[dotOne, dotTwo, dotThree].map((opacity, index) => (
            <Animated.View
              key={index}
              style={[styles.dot, { backgroundColor: colors.secondaryLabel, opacity: reduceMotion ? 0.7 : opacity }]}
            />
          ))}
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", paddingHorizontal: KitLayout.screenGutter, marginBottom: PlayTTSpacing.sm },
  bubble: {
    flexDirection: "row",
    alignItems: "center",
    gap: PlayTTSpacing.xs,
    borderRadius: 20,
    borderBottomLeftRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: PlayTTSpacing.md,
    paddingVertical: PlayTTSpacing.sm,
  },
  dots: { flexDirection: "row", gap: 4 },
  dot: { width: 7, height: 7, borderRadius: 4 },
})
