import { useEffect, useMemo, useRef } from "react"
import { Animated, StyleSheet, Text, View } from "react-native"

import {
  PlayTTFontFamilies,
  PlayTTSpacing,
} from "@/constants/playtt-tokens"
import { useProductTheme } from "@/hooks/use-product-theme"

export function CoachChatTypingIndicator() {
  const theme = useProductTheme()
  const dotOne = useRef(new Animated.Value(0.35)).current
  const dotTwo = useRef(new Animated.Value(0.35)).current
  const dotThree = useRef(new Animated.Value(0.35)).current

  useEffect(() => {
    const animateDot = (value: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(value, {
            toValue: 1,
            duration: 320,
            useNativeDriver: true,
          }),
          Animated.timing(value, {
            toValue: 0.35,
            duration: 320,
            useNativeDriver: true,
          }),
        ]),
      )

    const animations = [
      animateDot(dotOne, 0),
      animateDot(dotTwo, 120),
      animateDot(dotThree, 240),
    ]
    animations.forEach((animation) => animation.start())

    return () => {
      animations.forEach((animation) => animation.stop())
    }
  }, [dotOne, dotTwo, dotThree])

  const styles = useMemo(
    () =>
      StyleSheet.create({
        row: {
          paddingHorizontal: PlayTTSpacing.xl,
          alignItems: "flex-start",
          marginBottom: PlayTTSpacing.sm,
        },
        bubble: {
          flexDirection: "row",
          alignItems: "center",
          gap: PlayTTSpacing.xs,
          backgroundColor: theme.elevated,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: theme.border,
          borderRadius: 18,
          paddingHorizontal: PlayTTSpacing.md,
          paddingVertical: PlayTTSpacing.sm,
        },
        label: {
          fontSize: 13,
          fontFamily: PlayTTFontFamilies.medium,
          color: theme.muted,
          marginRight: PlayTTSpacing.xs,
        },
        dots: {
          flexDirection: "row",
          alignItems: "center",
          gap: 4,
        },
        dot: {
          width: 6,
          height: 6,
          borderRadius: 3,
          backgroundColor: theme.muted,
        },
      }),
    [theme],
  )

  return (
    <View style={styles.row}>
      <View style={styles.bubble}>
        <Text style={styles.label}>Coach is typing</Text>
        <View style={styles.dots}>
          <Animated.View style={[styles.dot, { opacity: dotOne }]} />
          <Animated.View style={[styles.dot, { opacity: dotTwo }]} />
          <Animated.View style={[styles.dot, { opacity: dotThree }]} />
        </View>
      </View>
    </View>
  )
}
