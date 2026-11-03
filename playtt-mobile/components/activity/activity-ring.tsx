import { useEffect } from "react"
import { StyleSheet, View } from "react-native"
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
} from "react-native-reanimated"
import Svg, { Circle } from "react-native-svg"

import { appleSpring } from "@/constants/motion"
import { IconSymbol } from "@/components/ui/icon-symbol"

const AnimatedCircle = Animated.createAnimatedComponent(Circle)

/** A slow, weighty fill, like closing a ring on Apple Watch: no bounce. */
const FILL_SPRING = appleSpring({ response: 1.1, dampingRatio: 1 })

type ActivityRingProps = {
  size: number
  lineWidth: number
  /** 0 to 1 is one lap; above 1 the ring wraps around a second time. */
  progress: number
  color: string
  /** The lap past 100%; defaults to a lighter shade so it shows over the first. */
  overlapColor?: string
  /** Colour of the arrow inside the end cap. */
  capIconColor?: string
  /** Draw the round cap with an arrow at the leading end. */
  showCap?: boolean
  /** Fill in with motion. Turn off for exported images. */
  animated?: boolean
  /** Wait this long before the fill starts, so rings can arrive in turn. */
  delayMs?: number
}

/**
 * An activity ring: a faint track with the progress drawn over it, and a
 * round cap carrying an arrow at the leading end. It fills with a slow
 * spring on arrival and whenever the number changes, and goes round again
 * past 100%.
 */
export function ActivityRing({
  size,
  lineWidth,
  progress,
  color,
  overlapColor,
  capIconColor = "#07111D",
  showCap = true,
  animated = true,
  delayMs = 0,
}: ActivityRingProps) {
  const reducedMotion = useReducedMotion()
  const motion = animated && !reducedMotion
  const radius = (size - lineWidth) / 2
  const circumference = 2 * Math.PI * radius
  const target = Math.max(0, progress)
  const filled = useSharedValue(motion ? 0 : target)

  useEffect(() => {
    if (!motion) {
      filled.set(target)
      return
    }
    filled.set(withDelay(delayMs, withSpring(target, FILL_SPRING)))
  }, [target, motion, delayMs, filled])

  const firstLap = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - Math.min(filled.get(), 1)),
  }))
  const secondLap = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - Math.min(Math.max(filled.get() - 1, 0), 1)),
    opacity: filled.get() > 1 ? 1 : 0,
  }))

  // The cap rides the end of the ring: a full turn per lap.
  const capStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${filled.get() * 360}deg` }],
  }))
  const capGlow = useAnimatedStyle(() => ({
    shadowOpacity: interpolate(filled.get(), [0, 1], [0, 0.35], Extrapolation.CLAMP),
  }))

  const lapColor = overlapColor ?? color

  return (
    <View
      style={{ width: size, height: size }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Svg width={size} height={size} style={styles.rotate}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeOpacity={0.2}
          strokeWidth={lineWidth}
          fill="none"
        />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={lineWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          animatedProps={firstLap}
          fill="none"
        />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={lapColor}
          strokeWidth={lineWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          animatedProps={secondLap}
          fill="none"
        />
      </Svg>
      {showCap ? (
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, capStyle]}>
          <Animated.View
            style={[
              styles.cap,
              {
                width: lineWidth,
                height: lineWidth,
                borderRadius: lineWidth / 2,
                left: (size - lineWidth) / 2,
                backgroundColor: color,
                shadowColor: "#000",
              },
              capGlow,
            ]}
          >
            <IconSymbol name="arrow.right" size={Math.round(lineWidth * 0.62)} color={capIconColor} />
          </Animated.View>
        </Animated.View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  // SVG circles start at 3 o'clock; a quarter turn back puts the start at 12.
  rotate: { transform: [{ rotate: "-90deg" }] },
  cap: {
    position: "absolute",
    top: 0,
    alignItems: "center",
    justifyContent: "center",
    shadowOffset: { width: -2, height: 0 },
    shadowRadius: 4,
  },
})
