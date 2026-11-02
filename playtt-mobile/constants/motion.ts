import type { WithSpringConfig, WithTimingConfig } from "react-native-reanimated"
import { Easing } from "react-native-reanimated"

/**
 * Redesign motion tokens (see `.cursor/skills/apple-design/SKILL.md`).
 *
 * Springs are defined the way Apple designs them — response (seconds) and
 * damping ratio — and converted to physical stiffness/damping, the same
 * mapping SwiftUI uses. Physics springs (not duration springs) start from the
 * on-screen value and accept the finger's release velocity, so every
 * animation can be grabbed and reversed mid-flight.
 *
 * Default to damping 1 (no bounce). Use `sheet`/`flick` only after a drag or
 * throw. Under reduced motion, swap transform animations for `FADE_QUICK`.
 */

type AppleSpring = { response: number; dampingRatio: number }

export function appleSpring({ response, dampingRatio }: AppleSpring): WithSpringConfig {
  "worklet"
  const mass = 1
  return {
    mass,
    stiffness: ((2 * Math.PI) / response) ** 2 * mass,
    damping: (4 * Math.PI * dampingRatio * mass) / response,
  }
}

export const SpringTokens = {
  /** Moving or resizing anything, layout changes. */
  default: { response: 0.4, dampingRatio: 1 },
  /** Selection pill sliding, toggles, tab highlight. */
  snappy: { response: 0.3, dampingRatio: 1 },
  /** Press-down scale and release. */
  press: { response: 0.15, dampingRatio: 1 },
  /** Sheets and drawers released after a drag or flick. */
  sheet: { response: 0.3, dampingRatio: 0.8 },
  /** Cards and carousels released after a throw. */
  flick: { response: 0.4, dampingRatio: 0.8 },
} as const satisfies Record<string, AppleSpring>

export type SpringToken = keyof typeof SpringTokens

/** Spring config for a token, optionally carrying the gesture's release velocity (px/s). */
export function spring(token: SpringToken, velocity?: number): WithSpringConfig {
  "worklet"
  const config = appleSpring(SpringTokens[token])
  return velocity === undefined ? config : { ...config, velocity }
}

/** Reduced-motion replacement for every spring: a short opacity cross-fade. */
export const FADE_QUICK: WithTimingConfig = {
  duration: 200,
  easing: Easing.out(Easing.quad),
}

/** Pressables scale to this on touch-down. */
export const PRESS_SCALE = 0.97

/** Movement (pt) before a drag commits to a direction. */
export const DRAG_THRESHOLD = 10

/**
 * Where a flick would come to rest, using Apple's scroll-deceleration model.
 * 0.998 feels like a normal scroll; 0.99 is snappier.
 */
export function projectMomentum(velocity: number, decelerationRate = 0.998): number {
  "worklet"
  return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate)
}

/** Progressive resistance past a boundary: the further over, the less it follows. */
export function rubberband(overshoot: number, dimension: number, constant = 0.55): number {
  "worklet"
  if (dimension <= 0) return 0
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot))
}

/** Snap target nearest a (projected) position. */
export function nearestSnapPoint(value: number, points: readonly number[]): number {
  "worklet"
  let best = points[0]
  for (const point of points) {
    if (Math.abs(point - value) < Math.abs(best - value)) best = point
  }
  return best
}
