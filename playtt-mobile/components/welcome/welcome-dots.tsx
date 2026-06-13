import { useEffect } from "react"
import { StyleSheet, View } from "react-native"
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated"

import { PlayTTColors, PlayTTSpacing } from "@/constants/playtt-tokens"

export const WELCOME_SLIDE_COUNT = 4

type WelcomeDotsProps = {
  count?: number
  activeIndex: number
  animate?: boolean
}

function Dot({ active, animate }: { active: boolean; animate: boolean }) {
  const scale = useSharedValue(active ? 1.2 : 1)

  useEffect(() => {
    if (animate) {
      scale.value = withTiming(active ? 1.2 : 1, { duration: 200 })
    } else {
      scale.value = active ? 1.2 : 1
    }
  }, [active, animate, scale])

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))

  return (
    <Animated.View
      style={[
        styles.dot,
        active ? styles.dotActive : styles.dotInactive,
        animatedStyle,
      ]}
    />
  )
}

export function WelcomeDots({
  count = WELCOME_SLIDE_COUNT,
  activeIndex,
  animate = true,
}: WelcomeDotsProps) {
  return (
    <View style={styles.dots} accessibilityRole="tablist">
      {Array.from({ length: count }, (_, index) => (
        <Dot key={index} active={index === activeIndex} animate={animate} />
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: PlayTTSpacing.xs,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotActive: {
    backgroundColor: PlayTTColors.foreground,
  },
  dotInactive: {
    backgroundColor: "rgba(255, 255, 255, 0.35)",
  },
})
