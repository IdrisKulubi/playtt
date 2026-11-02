import {
  Pressable,
  type GestureResponderEvent,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from "react-native"
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from "react-native-reanimated"

import { KitLayout } from "@/constants/kit-layout"
import { PRESS_SCALE, spring } from "@/constants/motion"
import { haptics } from "@/lib/haptics"

const AnimatedPressable = Animated.createAnimatedComponent(Pressable)

const PRESSED_OPACITY = 0.85
const DISABLED_OPACITY = 0.4

export type PressableScaleProps = Omit<PressableProps, "style"> & {
  style?: StyleProp<ViewStyle>
  /** Haptic fired on touch-down. Leave unset for ordinary navigation. */
  haptic?: "selection" | "commit"
  /** Scale on press; large surfaces like cards may want less (e.g. 0.98). */
  pressedScale?: number
}

/**
 * The one pressable for redesigned UI: reacts on touch-down (never on
 * release), springs back from wherever it is, and guarantees a 48 pt target.
 * Under reduced motion it dims without scaling.
 */
export function PressableScale({
  style,
  haptic,
  pressedScale = PRESS_SCALE,
  disabled,
  onPressIn,
  onPressOut,
  accessibilityRole = "button",
  ...rest
}: PressableScaleProps) {
  const reducedMotion = useReducedMotion()
  const pressed = useSharedValue(0)

  const restOpacity = disabled ? DISABLED_OPACITY : 1

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: restOpacity * (1 - pressed.get() * (1 - PRESSED_OPACITY)),
    transform: [{ scale: reducedMotion ? 1 : 1 - pressed.get() * (1 - pressedScale) }],
  }))

  const handlePressIn = (event: GestureResponderEvent) => {
    pressed.set(withSpring(1, spring("press")))
    if (haptic) haptics[haptic]()
    onPressIn?.(event)
  }

  const handlePressOut = (event: GestureResponderEvent) => {
    pressed.set(withSpring(0, spring("press")))
    onPressOut?.(event)
  }

  return (
    <AnimatedPressable
      {...rest}
      disabled={disabled}
      accessibilityRole={accessibilityRole}
      accessibilityState={{ disabled: Boolean(disabled), ...rest.accessibilityState }}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[
        { minHeight: KitLayout.minTouchTarget, minWidth: KitLayout.minTouchTarget },
        style,
        animatedStyle,
      ]}
    />
  )
}
