import { useEffect, type ReactNode } from "react"
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native"
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated"

import { PlayTTSpacing } from "@/constants/playtt-tokens"
import { useAppTheme } from "@/hooks/use-app-theme"

/** @deprecated Skeletons follow the phone's light/dark setting now. */
export type SkeletonSurface = "dark" | "product"

/**
 * Neutral placeholder grey, like iOS's system fill. Brand cyan would read
 * as "selected", so loading shapes stay colourless.
 */
const BONE_COLOR = {
  light: "rgba(120, 120, 128, 0.16)",
  dark: "rgba(120, 120, 128, 0.32)",
} as const

/** One slow breath: dim, then back. Slow reads as calm, not as an alarm. */
const PULSE = { duration: 1000, easing: Easing.inOut(Easing.sin) }

export type SkeletonProps = {
  width?: number | `${number}%`
  height?: number
  borderRadius?: number
  /** @deprecated Ignored; the theme decides the colour. */
  surface?: SkeletonSurface
  style?: StyleProp<ViewStyle>
}

/** A placeholder shape that gently pulses (still, with Reduce Motion). */
export function Skeleton({ width = "100%", height = 16, borderRadius = 6, style }: SkeletonProps) {
  const { scheme } = useAppTheme()
  const reducedMotion = useReducedMotion()
  const opacity = useSharedValue(1)

  useEffect(() => {
    if (reducedMotion) {
      opacity.set(1)
      return
    }
    opacity.set(withRepeat(withTiming(0.5, PULSE), -1, true))
    return () => cancelAnimation(opacity)
  }, [opacity, reducedMotion])

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.get() }))

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.bone,
        { width, height, borderRadius, backgroundColor: BONE_COLOR[scheme] },
        animatedStyle,
        style,
      ]}
    />
  )
}

type SkeletonTextProps = Omit<SkeletonProps, "height" | "width"> & {
  width?: SkeletonProps["width"]
  lines?: number
}

/** Lines of text; the last line is shorter, like a real paragraph. */
export function SkeletonText({ width = "72%", lines = 1, borderRadius, style }: SkeletonTextProps) {
  if (lines === 1) {
    return <Skeleton width={width} height={14} borderRadius={borderRadius} style={style} />
  }

  return (
    <SkeletonGroup gap="xs" style={style}>
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton
          key={index}
          width={index === lines - 1 ? "55%" : width}
          height={14}
          borderRadius={borderRadius}
        />
      ))}
    </SkeletonGroup>
  )
}

type SkeletonCircleProps = Omit<SkeletonProps, "width" | "height" | "borderRadius"> & {
  size?: number
}

export function SkeletonCircle({ size = 40, style }: SkeletonCircleProps) {
  return <Skeleton width={size} height={size} borderRadius={size / 2} style={style} />
}

type SkeletonGroupProps = {
  children: ReactNode
  direction?: "vertical" | "horizontal"
  gap?: keyof typeof PlayTTSpacing
  style?: StyleProp<ViewStyle>
}

export function SkeletonGroup({ children, direction = "vertical", gap = "md", style }: SkeletonGroupProps) {
  return (
    <View
      style={[
        direction === "vertical" ? styles.groupVertical : styles.groupHorizontal,
        { gap: PlayTTSpacing[gap] },
        style,
      ]}
    >
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  bone: { borderCurve: "continuous" },
  groupVertical: { flexDirection: "column" },
  groupHorizontal: { flexDirection: "row", alignItems: "center" },
})
