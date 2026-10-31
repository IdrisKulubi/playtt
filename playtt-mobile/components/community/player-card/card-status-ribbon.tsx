import { useEffect } from "react"
import { StyleSheet, Text, View } from "react-native"
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated"

import { PlayTTFontFamilies } from "@/constants/playtt-tokens"

import { OPEN_NOW_GREEN, type CardTierTokens, type StatusRibbon } from "./card-tiers"

type PulseDotProps = { color: string; size?: number; animate: boolean }

/** Opacity 0.4 ↔ 1 on a 1.2 s loop; static under Reduce Motion. */
export function PulseDot({ color, size = 7, animate }: PulseDotProps) {
  const opacity = useSharedValue(1)

  useEffect(() => {
    if (!animate) {
      cancelAnimation(opacity)
      opacity.value = 1
      return
    }
    opacity.value = withRepeat(withTiming(0.4, { duration: 600 }), -1, true)
    return () => cancelAnimation(opacity)
  }, [animate, opacity])

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }))

  return (
    <Animated.View
      style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }, style]}
    />
  )
}

type CardStatusRibbonProps = {
  ribbon: StatusRibbon
  tokens: CardTierTokens
  compact?: boolean
  animate: boolean
}

export function CardStatusRibbon({ ribbon, tokens, compact = false, animate }: CardStatusRibbonProps) {
  const isNow = ribbon.kind === "now"
  // Compact cards drop the end time so the ribbon fits half the screen width.
  const label = compact && isNow ? "OPEN NOW" : ribbon.label

  return (
    <View style={styles.row}>
      <View
        style={[
          styles.chip,
          isNow
            ? { backgroundColor: "rgba(46, 232, 122, 0.16)", borderColor: "rgba(46, 232, 122, 0.55)" }
            : { borderColor: tokens.accent },
        ]}
      >
        {isNow ? <PulseDot color={OPEN_NOW_GREEN} animate={animate} size={6} /> : null}
        <Text
          numberOfLines={1}
          style={[styles.label, compact && styles.labelCompact, { color: isNow ? tokens.text : tokens.accent }]}
        >
          {label}
        </Text>
      </View>
      {ribbon.doubles ? (
        <View style={[styles.chip, { borderColor: tokens.accent, backgroundColor: tokens.plate }]}>
          <Text style={[styles.label, compact && styles.labelCompact, { color: tokens.accent }]}>2v2</Text>
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    flexWrap: "wrap",
    gap: 4,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  label: {
    fontFamily: PlayTTFontFamilies.bold,
    fontSize: 10,
    letterSpacing: 0.6,
  },
  labelCompact: {
    fontSize: 9,
  },
})
