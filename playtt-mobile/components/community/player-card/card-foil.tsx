import { useEffect } from "react"
import { StyleSheet, Text, View } from "react-native"
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated"
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg"

import { PlayTTFontFamilies } from "@/constants/playtt-tokens"

import type { CardTierTokens } from "./card-tiers"

const SWEEP_MS = 1800
const SWEEP_EVERY_MS = 6000

type CardShineProps = {
  width: number
  height: number
  top: number
  opacity: number
  enabled: boolean
  idPrefix: string
}

/** Diagonal highlight that sweeps across Club and Elite full cards. */
export function CardShine({ width, height, top, opacity, enabled, idPrefix }: CardShineProps) {
  const progress = useSharedValue(0)

  useEffect(() => {
    if (!enabled) {
      cancelAnimation(progress)
      progress.value = 0
      return
    }

    progress.value = withRepeat(
      withSequence(
        withTiming(1, { duration: SWEEP_MS, easing: Easing.inOut(Easing.quad) }),
        withDelay(SWEEP_EVERY_MS - SWEEP_MS, withTiming(0, { duration: 0 })),
      ),
      -1,
    )

    return () => cancelAnimation(progress)
  }, [enabled, progress])

  const band = width * 0.55
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -band + progress.value * (width + band * 2) }, { rotate: "18deg" }],
  }))

  if (!enabled || opacity <= 0 || width <= 0) {
    return null
  }

  return (
    <View pointerEvents="none" style={[styles.clip, { top }]}>
      <Animated.View style={[{ width: band, height: height * 1.6, marginTop: -height * 0.3 }, animatedStyle]}>
        <Svg width={band} height={height * 1.6}>
          <Defs>
            <LinearGradient id={`${idPrefix}-shine`} x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor="#ffffff" stopOpacity={0} />
              <Stop offset="0.5" stopColor="#ffffff" stopOpacity={opacity} />
              <Stop offset="1" stopColor="#ffffff" stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Rect x={0} y={0} width={band} height={height * 1.6} fill={`url(#${idPrefix}-shine)`} />
        </Svg>
      </Animated.View>
    </View>
  )
}

/** Permanent stamp for players who joined during the pilot. */
export function FoundingStamp({ tokens }: { tokens: CardTierTokens }) {
  return (
    <View
      accessible={false}
      style={[styles.stamp, { borderColor: tokens.accent, backgroundColor: tokens.plate }]}
    >
      <Text style={[styles.stampText, { color: tokens.accent }]}>FOUNDING</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  clip: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    overflow: "hidden",
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  stamp: {
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
    transform: [{ rotate: "-6deg" }],
  },
  stampText: {
    fontFamily: PlayTTFontFamilies.bold,
    fontSize: 9,
    letterSpacing: 1.2,
  },
})
