import { useEffect, type ReactNode } from "react"
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native"
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated"

import {
  PlayTTColors,
  PlayTTRadius,
  PlayTTSpacing,
} from "@/constants/playtt-tokens"

export type SkeletonSurface = "dark" | "product"

const SURFACE_COLORS: Record<SkeletonSurface, string> = {
  dark: PlayTTColors.backgroundElevated,
  product: PlayTTColors.productElevated,
}

export type SkeletonProps = {
  width?: number | `${number}%`
  height?: number
  borderRadius?: number
  surface?: SkeletonSurface
  style?: StyleProp<ViewStyle>
}

export function Skeleton({
  width = "100%",
  height = 16,
  borderRadius = PlayTTRadius.md,
  surface = "dark",
  style,
}: SkeletonProps) {
  const opacity = useSharedValue(0.45)

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(1, {
        duration: 900,
        easing: Easing.inOut(Easing.ease),
      }),
      -1,
      true,
    )
  }, [opacity])

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }))

  return (
    <Animated.View
      style={[
        styles.bone,
        {
          width,
          height,
          borderRadius,
          backgroundColor: SURFACE_COLORS[surface],
        },
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

export function SkeletonText({
  width = "72%",
  lines = 1,
  surface = "dark",
  borderRadius = PlayTTRadius.sm,
  style,
}: SkeletonTextProps) {
  if (lines === 1) {
    return (
      <Skeleton
        width={width}
        height={14}
        borderRadius={borderRadius}
        surface={surface}
        style={style}
      />
    )
  }

  return (
    <SkeletonGroup gap="xs" style={style}>
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton
          key={index}
          width={index === lines - 1 ? "55%" : width}
          height={14}
          borderRadius={borderRadius}
          surface={surface}
        />
      ))}
    </SkeletonGroup>
  )
}

type SkeletonCircleProps = Omit<SkeletonProps, "width" | "height" | "borderRadius"> & {
  size?: number
}

export function SkeletonCircle({
  size = 40,
  surface = "dark",
  style,
}: SkeletonCircleProps) {
  return (
    <Skeleton
      width={size}
      height={size}
      borderRadius={PlayTTRadius.pill}
      surface={surface}
      style={style}
    />
  )
}

type SkeletonGroupProps = {
  children: ReactNode
  direction?: "vertical" | "horizontal"
  gap?: keyof typeof PlayTTSpacing
  style?: StyleProp<ViewStyle>
}

export function SkeletonGroup({
  children,
  direction = "vertical",
  gap = "md",
  style,
}: SkeletonGroupProps) {
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
  bone: {
    overflow: "hidden",
  },
  groupVertical: {
    flexDirection: "column",
  },
  groupHorizontal: {
    flexDirection: "row",
    alignItems: "center",
  },
})
