import { useEffect, useState } from "react"
import { StyleSheet, View, type LayoutChangeEvent } from "react-native"
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from "react-native-reanimated"

import { PressableScale } from "@/components/kit/pressable-scale"
import { AppText } from "@/components/ui/app-text"
import { FADE_QUICK, spring } from "@/constants/motion"
import { CHROME_MAX_FONT_SCALE } from "@/constants/type"
import { useAppTheme } from "@/hooks/use-app-theme"

type SegmentedControlProps<T extends string> = {
  /** Read out before the options, e.g. "Card style". */
  label: string
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
  /** "onGlass" suits the dark glass of the sign-in screens, whatever the app theme. */
  appearance?: "app" | "onGlass"
}

const PADDING = 3
const HEIGHT = 40

/**
 * Apple's segmented control: a quiet tinted track with a raised thumb that
 * slides under the chosen label on a snappy spring.
 */
export function SegmentedControl<T extends string>({ label, value, options, onChange, appearance = "app" }: SegmentedControlProps<T>) {
  const { colors: appColors, scheme: appScheme } = useAppTheme()
  const onGlass = appearance === "onGlass"
  const scheme = onGlass ? "dark" : appScheme
  const colors = onGlass
    ? { ...appColors, fill: "rgba(3, 27, 54, 0.45)", surface: "rgba(255,255,255,0.2)" }
    : appColors
  const reducedMotion = useReducedMotion()
  const [trackWidth, setTrackWidth] = useState(0)
  const index = Math.max(0, options.findIndex((option) => option.value === value))
  const segmentWidth = trackWidth > 0 ? (trackWidth - PADDING * 2) / options.length : 0
  const position = useSharedValue(index)

  useEffect(() => {
    position.set(reducedMotion ? withTiming(index, FADE_QUICK) : withSpring(index, spring("snappy")))
  }, [index, reducedMotion, position])

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: position.get() * segmentWidth }],
  }))

  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
      onLayout={(event: LayoutChangeEvent) => setTrackWidth(event.nativeEvent.layout.width)}
      style={[styles.track, { backgroundColor: colors.fill }]}
    >
      {segmentWidth > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.thumb,
            { width: segmentWidth, backgroundColor: scheme === "dark" ? "rgba(255,255,255,0.18)" : colors.surface },
            thumbStyle,
          ]}
        />
      ) : null}
      {options.map((option) => {
        const selected = option.value === value
        return (
          <PressableScale
            key={option.value}
            onPress={() => onChange(option.value)}
            haptic="selection"
            pressedScale={0.97}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            accessibilityLabel={option.label}
            style={styles.segment}
          >
            <AppText
              variant="subheadline"
              weight={selected ? "600" : "500"}
              color={selected ? "label" : "secondaryLabel"}
              style={onGlass ? { color: selected ? "#F6FCFF" : "rgba(246,252,255,0.7)" } : undefined}
              maxFontSizeMultiplier={CHROME_MAX_FONT_SCALE}
              numberOfLines={1}
            >
              {option.label}
            </AppText>
          </PressableScale>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  track: {
    flexDirection: "row",
    padding: PADDING,
    minHeight: HEIGHT,
    borderRadius: (HEIGHT + PADDING * 2) / 2,
    borderCurve: "continuous",
  },
  thumb: {
    position: "absolute",
    top: PADDING,
    bottom: PADDING,
    left: PADDING,
    borderRadius: HEIGHT / 2,
    borderCurve: "continuous",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.16,
    shadowRadius: 5,
    elevation: 2,
  },
  segment: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
})
