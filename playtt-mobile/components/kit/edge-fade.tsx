import MaskedViewBase from "@react-native-masked-view/masked-view"
import { BlurView } from "expo-blur"
import { LinearGradient } from "expo-linear-gradient"
import type { ComponentType, ReactElement } from "react"
import { Platform, StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewProps, type ViewStyle } from "react-native"
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated"

// The package's class types predate React 19's JSX types; the component is fine.
const MaskedView = MaskedViewBase as unknown as ComponentType<ViewProps & { maskElement: ReactElement }>

/**
 * "Scrim" easing (from easing-gradients): opacity falls fast at first and
 * then ever more gently, so the fade never shows the line where it ends.
 * A straight gradient leaves a visible kink; this one doesn't.
 */
const SCRIM_STOPS = [0, 0.19, 0.34, 0.47, 0.565, 0.65, 0.73, 0.802, 0.861, 0.91, 0.952, 0.982, 1] as const
const SCRIM_ALPHA = [1, 0.738, 0.541, 0.382, 0.278, 0.194, 0.126, 0.075, 0.042, 0.021, 0.008, 0.002, 0] as const

function rgba(hex: string, alpha: number) {
  const value = parseInt(hex.slice(1), 16)
  return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`
}

type Colors = readonly [string, string, ...string[]]

type EdgeFadeProps = {
  /** Which edge of its parent the fade sits on; it is strongest right there. */
  edge: "top" | "bottom"
  height: number
  /** The colour behind the content (#rrggbb): the page or the card it fades into. */
  color: string
  scheme: "light" | "dark"
  /** How dark the edge gets at its strongest, 0 to 1. */
  darkness?: number
  style?: StyleProp<ViewStyle>
}

/**
 * Content sinking into an edge: one blur, faded out by a soft mask, plus a
 * darkening in the background colour on the same eased curve. Both reach
 * zero gradually, so nobody can tell where the fade starts. The blur shows
 * on iPhone only; elsewhere the darkening does the work.
 */
export function EdgeFade({ edge, height, color, scheme, darkness = 0.94, style }: EdgeFadeProps) {
  const solid = /^#[0-9a-f]{6}$/i.test(color) ? color : scheme === "dark" ? "#000000" : "#FFFFFF"
  const darkening = SCRIM_ALPHA.map((alpha) => rgba(solid, alpha * darkness)) as unknown as Colors
  const mask = SCRIM_ALPHA.map((alpha) => `rgba(0, 0, 0, ${alpha})`) as unknown as Colors
  // Gradients run top to bottom; the bottom edge runs the other way.
  const direction = edge === "top" ? ({ start: { x: 0, y: 0 }, end: { x: 0, y: 1 } } as const) : ({ start: { x: 0, y: 1 }, end: { x: 0, y: 0 } } as const)
  const position = edge === "top" ? { top: 0 } : { bottom: 0 }

  return (
    <View pointerEvents="none" style={[styles.fade, position, { height }, style]}>
      {Platform.OS === "ios" ? (
        <MaskedView
          style={StyleSheet.absoluteFill}
          maskElement={
            <LinearGradient colors={mask} locations={SCRIM_STOPS} {...direction} style={StyleSheet.absoluteFill} />
          }
        >
          <BlurView tint={scheme === "dark" ? "dark" : "light"} intensity={28} style={StyleSheet.absoluteFill} />
        </MaskedView>
      ) : null}
      <LinearGradient colors={darkening} locations={SCRIM_STOPS} {...direction} style={StyleSheet.absoluteFill} />
    </View>
  )
}

/**
 * The solid base behind a bar that content scrolls under (a footer): the
 * same blur and darkness a fade has at its strongest, so an EdgeFade sitting
 * on top of the bar meets it with no step.
 */
export function EdgeBackdrop({ color, scheme, darkness = 0.94 }: Pick<EdgeFadeProps, "color" | "scheme" | "darkness">) {
  const solid = /^#[0-9a-f]{6}$/i.test(color) ? color : scheme === "dark" ? "#000000" : "#FFFFFF"

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {Platform.OS === "ios" ? (
        <BlurView tint={scheme === "dark" ? "dark" : "light"} intensity={28} style={StyleSheet.absoluteFill} />
      ) : null}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: rgba(solid, darkness) }]} />
    </View>
  )
}

/** How tall the soft edge is where content slides out of a scrolling area. */
const SCROLL_EDGE_HEIGHT = 44
/** Scroll distance over which an edge fade comes in, so it never pops. */
const SCROLL_EDGE_RAMP = 24

/**
 * Tracks a scroll view so each edge fades in only once content is hidden
 * behind it. Spread `scrollProps` onto an Animated.ScrollView and render
 * <ScrollEdgeFades> beside it, inside a shared parent.
 */
export function useScrollEdgeFades() {
  const scrollY = useSharedValue(0)
  const viewportHeight = useSharedValue(0)
  const contentHeight = useSharedValue(0)

  const onScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.set(event.contentOffset.y)
      viewportHeight.set(event.layoutMeasurement.height)
      contentHeight.set(event.contentSize.height)
    },
  })

  const topStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.get(), [0, SCROLL_EDGE_RAMP], [0, 1], Extrapolation.CLAMP),
  }))
  const bottomStyle = useAnimatedStyle(() => {
    const hidden = contentHeight.get() - viewportHeight.get() - scrollY.get()
    return { opacity: interpolate(hidden, [0, SCROLL_EDGE_RAMP], [0, 1], Extrapolation.CLAMP) }
  })

  return {
    scrollProps: {
      onScroll,
      scrollEventThrottle: 16,
      onLayout: (event: LayoutChangeEvent) => viewportHeight.set(event.nativeEvent.layout.height),
      onContentSizeChange: (_width: number, height: number) => contentHeight.set(height),
    },
    topStyle,
    bottomStyle,
  }
}

type ScrollEdgeFadesProps = {
  fades: Pick<ReturnType<typeof useScrollEdgeFades>, "topStyle" | "bottomStyle">
  /** The colour the scrolling content sits on, so the fade blends into it. */
  color: string
  scheme: "light" | "dark"
}

/** The two edge fades; put them over a scroll view. They ignore touches. */
export function ScrollEdgeFades({ fades, color, scheme }: ScrollEdgeFadesProps) {
  return (
    <>
      <Animated.View pointerEvents="none" style={[styles.edge, styles.edgeTop, fades.topStyle]}>
        <EdgeFade edge="top" height={SCROLL_EDGE_HEIGHT} color={color} scheme={scheme} />
      </Animated.View>
      <Animated.View pointerEvents="none" style={[styles.edge, styles.edgeBottom, fades.bottomStyle]}>
        <EdgeFade edge="bottom" height={SCROLL_EDGE_HEIGHT} color={color} scheme={scheme} />
      </Animated.View>
    </>
  )
}

const styles = StyleSheet.create({
  fade: { position: "absolute", left: 0, right: 0 },
  edge: { position: "absolute", left: 0, right: 0, height: SCROLL_EDGE_HEIGHT },
  edgeTop: { top: 0 },
  edgeBottom: { bottom: 0 },
})
