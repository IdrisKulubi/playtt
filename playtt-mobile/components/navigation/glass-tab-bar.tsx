/**
 * Compact floating tab bar, like Apple's Fitness app on iOS 26: a glass
 * capsule that hugs its tabs and sits centred above the home indicator,
 * with a lighter chip behind the current tab and that tab in colour.
 *
 * Adapted from expo-glass-tabs (MIT, © 2026 David Mokos), whose bar always
 * spans the full width. Scrubbing, the sliding chip and minimize-on-scroll
 * work the same way and share its minimize state.
 */
import * as Haptics from "expo-haptics"
import type { TabListProps, TabTriggerSlotProps } from "expo-router/ui"
import { setMinimized, useMinimizeState } from "expo-glass-tabs/build/minimize-context"
import { Children, createContext, use, useCallback, useEffect, useMemo, type ReactNode } from "react"
import { Platform, Pressable, StyleSheet, useWindowDimensions, View } from "react-native"
import { Gesture, GestureDetector } from "react-native-gesture-handler"
import Animated, {
  Extrapolation,
  interpolate,
  interpolateColor,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  type SharedValue,
} from "react-native-reanimated"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { BlurView } from "expo-blur"
import { GlassView } from "expo-glass-effect"
import { LinearGradient } from "expo-linear-gradient"

import { useNativeLiquidGlass } from "@/components/ui/liquid-glass-surface"
import { FLOATING_TAB_BAR_PILL_HEIGHT } from "@/constants/navigation-layout"

const EXPANDED_HEIGHT = FLOATING_TAB_BAR_PILL_HEIGHT
const MINIMIZED_HEIGHT = 46
/** Each tab's width: wide enough for "Bookings" at a comfortable size. */
const ITEM_WIDTH = 86
const ITEM_WIDTH_MINIMIZED = 60
/** Gap between the capsule wall and the chip. */
const ROW_PAD = 5
/** Smallest gap to the screen edges on narrow phones. */
const SCREEN_MARGIN = 12
const ICON_SIZE = 24
const LABEL_SIZE = 12
const LABEL_BLOCK = 16
const CHIP_EXPANDED = EXPANDED_HEIGHT - ROW_PAD * 2
const CHIP_MINIMIZED = MINIMIZED_HEIGHT - ROW_PAD * 2

const HIGHLIGHT_EDGE = "rgba(255, 255, 255, 0.14)"
/** Dark mode, like Health: a smoky grey chip, never a white one. */
const DARK_CHIP = "rgba(118, 118, 128, 0.36)"

/**
 * Liquid glass like iOS 26: clear enough to see the page moving through it, with a
 * bright rim and a soft sheen from the top-left corner. Native glass where the
 * phone has it; elsewhere a light blur with the same sheen and rim.
 */
function TabGlass({ scheme, native }: { scheme: "light" | "dark"; native: boolean }) {
  const dark = scheme === "dark"
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.capsule]}>
      {native ? (
        <GlassView glassEffectStyle="clear" colorScheme={scheme} style={StyleSheet.absoluteFill} />
      ) : (
        <BlurView
          intensity={dark ? 45 : 55}
          tint={dark ? "dark" : "light"}
          blurMethod="dimezisBlurViewSdk31Plus"
          style={StyleSheet.absoluteFill}
        />
      )}
      {dark ? <View style={[StyleSheet.absoluteFill, styles.smoke]} /> : null}
      <LinearGradient
        colors={[
          dark ? "rgba(255,255,255,0.09)" : "rgba(255,255,255,0.65)",
          dark ? "rgba(255,255,255,0)" : "rgba(255,255,255,0.12)",
          dark ? "rgba(255,255,255,0.035)" : "rgba(255,255,255,0.3)",
        ]}
        locations={[0, 0.55, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View
        style={[
          StyleSheet.absoluteFill,
          styles.capsule,
          { borderWidth: 1, borderColor: dark ? "rgba(255,255,255,0.13)" : "rgba(255,255,255,0.8)" },
        ]}
      />
    </View>
  )
}

/** Interruptible: hopping between tabs retargets with the velocity kept. */
const SLIDE_SPRING = { duration: 420, dampingRatio: 0.82 }

export type GlassTabBarTheme = {
  activeTint: string
  inactiveTint: string
  /** The chip behind the current tab. */
  highlight: string
  /** Tint layered over the liquid glass. */
  glassTint: string
  /** Used when liquid glass isn't available (before iOS 26, Android). */
  solidFallback: string
  border: string
  /** The page colour the bottom fade blends into. */
  background: string
  scheme: "light" | "dark"
}

export type GlassTabItem = {
  name: string
  label: string
  renderIcon: (props: { tint: string; size: number }) => ReactNode
}

type BarContextValue = {
  slideIndex: SharedValue<number>
  isDragging: SharedValue<boolean>
  theme: GlassTabBarTheme
}

const BarContext = createContext<BarContextValue | null>(null)

export type GlassTabBarProps = TabListProps & {
  onIndexSelected?: (index: number) => void
  theme: GlassTabBarTheme
}

export function GlassTabBar({ children, onIndexSelected, theme, ...props }: GlassTabBarProps) {
  const insets = useSafeAreaInsets()
  const { width: windowWidth } = useWindowDimensions()
  const minimized = useMinimizeState()
  const progress = minimized.progress
  const slideIndex = useSharedValue(0)
  const isDragging = useSharedValue(false)
  const lastTicked = useSharedValue(-1)
  const tabCount = Math.max(Children.count(children), 1)
  // Hug the tabs, but never wider than the screen allows.
  const maxItemWidth = (windowWidth - SCREEN_MARGIN * 2 - ROW_PAD * 2) / tabCount
  const expandedItem = Math.min(ITEM_WIDTH, maxItemWidth)
  const minimizedItem = Math.min(ITEM_WIDTH_MINIMIZED, maxItemWidth)

  const tick = useCallback(() => {
    if (Platform.OS === "ios") void Haptics.selectionAsync()
  }, [])

  const selectIndex = useCallback((index: number) => onIndexSelected?.(index), [onIndexSelected])

  const gesture = useMemo(() => {
    const indexAtX = (x: number, minimizedValue: number) => {
      "worklet"
      const itemWidth = interpolate(minimizedValue, [0, 1], [expandedItem, minimizedItem], Extrapolation.CLAMP)
      const raw = (x - ROW_PAD) / itemWidth - 0.5
      return Math.min(Math.max(raw, 0), tabCount - 1)
    }

    // Scrubbing: the chip follows the finger 1:1, ticks on each tab, and
    // switches screens only on release so content never jumps underneath.
    const pan = Gesture.Pan()
      .activeOffsetX([-6, 6])
      .failOffsetY([-14, 14])
      .onStart(() => {
        isDragging.set(true)
        lastTicked.set(Math.round(slideIndex.get()))
        setMinimized(minimized, 0)
      })
      .onUpdate((event) => {
        const index = indexAtX(event.x, progress.get())
        slideIndex.set(index)
        const rounded = Math.round(index)
        if (rounded !== lastTicked.get()) {
          lastTicked.set(rounded)
          runOnJS(tick)()
        }
      })
      .onFinalize(() => {
        if (!isDragging.get()) return
        const rounded = Math.round(slideIndex.get())
        slideIndex.set(withSpring(rounded, SLIDE_SPRING))
        runOnJS(selectIndex)(rounded)
        isDragging.set(false)
      })

    const tap = Gesture.Tap()
      .maxDistance(16)
      .maxDuration(400)
      .onEnd((event, success) => {
        if (!success) return
        const index = Math.round(indexAtX(event.x, progress.get()))
        slideIndex.set(withSpring(index, SLIDE_SPRING))
        setMinimized(minimized, 0)
        runOnJS(selectIndex)(index)
      })

    return Gesture.Race(pan, tap)
  }, [expandedItem, minimizedItem, tabCount, selectIndex, tick, isDragging, lastTicked, slideIndex, minimized, progress])

  const barStyle = useAnimatedStyle(() => {
    const height = interpolate(progress.get(), [0, 1], [EXPANDED_HEIGHT, MINIMIZED_HEIGHT], Extrapolation.CLAMP)
    const itemWidth = interpolate(progress.get(), [0, 1], [expandedItem, minimizedItem], Extrapolation.CLAMP)
    return { height, width: itemWidth * tabCount + ROW_PAD * 2, borderRadius: height / 2 }
  })

  const chipStyle = useAnimatedStyle(() => {
    const height = interpolate(progress.get(), [0, 1], [CHIP_EXPANDED, CHIP_MINIMIZED], Extrapolation.CLAMP)
    const itemWidth = interpolate(progress.get(), [0, 1], [expandedItem, minimizedItem], Extrapolation.CLAMP)
    return {
      height,
      width: itemWidth,
      borderRadius: height / 2,
      transform: [{ translateX: ROW_PAD + itemWidth * slideIndex.get() }],
    }
  })

  const bottomOffset = Math.max(insets.bottom - 14, 12)
  const barContext = useMemo(() => ({ slideIndex, isDragging, theme }), [slideIndex, isDragging, theme])
  const nativeGlass = useNativeLiquidGlass()
  return (
    <View {...props} pointerEvents="box-none" style={styles.host}>
      <View pointerEvents="box-none" style={[styles.center, { marginBottom: bottomOffset }]}>
        <GestureDetector gesture={gesture}>
          <Animated.View
            style={[
              styles.bar,
              !nativeGlass && styles.shadow,
              barStyle,
            ]}
          >
            <TabGlass scheme={theme.scheme} native={nativeGlass} />
            <Animated.View
              style={[styles.chip, { backgroundColor: theme.scheme === "dark" ? DARK_CHIP : theme.highlight, borderColor: HIGHLIGHT_EDGE }, chipStyle]}
            />
            <View style={styles.row}>
              <BarContext.Provider value={barContext}>{children}</BarContext.Provider>
            </View>
          </Animated.View>
        </GestureDetector>
      </View>
    </View>
  )
}

/** One tab: icon over a short label; the label folds away when minimized. */
export function GlassTabButton({
  item,
  index,
  isFocused,
  onPress,
  ...props
}: TabTriggerSlotProps & { item: GlassTabItem; index: number }) {
  const minimized = useMinimizeState()
  const progress = minimized.progress
  const bar = use(BarContext)
  const slideIndex = bar?.slideIndex
  const activeTint = bar?.theme.activeTint ?? "#FFFFFF"
  const inactiveTint = bar?.theme.inactiveTint ?? "#9E9EA6"

  // Follows navigation from anywhere (deep links, back), unless a finger owns the chip.
  useEffect(() => {
    if (isFocused && bar && !bar.isDragging.get()) {
      bar.slideIndex.set(withSpring(index, SLIDE_SPRING))
    }
  }, [isFocused, index, bar])

  // Colour follows the chip, so it travels with it while scrubbing.
  const activeGlyphStyle = useAnimatedStyle(() => ({
    opacity: slideIndex ? 1 - Math.min(Math.abs(slideIndex.get() - index), 1) : isFocused ? 1 : 0,
  }))

  const labelStyle = useAnimatedStyle(() => ({
    height: interpolate(progress.get(), [0, 1], [LABEL_BLOCK, 0], Extrapolation.CLAMP),
    opacity: interpolate(progress.get(), [0, 0.4], [1, 0], Extrapolation.CLAMP),
    color: slideIndex
      ? interpolateColor(Math.min(Math.abs(slideIndex.get() - index), 1), [0, 1], [activeTint, inactiveTint])
      : isFocused
        ? activeTint
        : inactiveTint,
  }))

  return (
    <Pressable
      {...(props as Omit<typeof props, "ref">)}
      accessibilityRole="tab"
      accessibilityLabel={item.label}
      accessibilityState={{ selected: Boolean(isFocused) }}
      onPress={(event) => {
        // The gesture handles fingers; this still fires for VoiceOver and keyboards.
        if (bar) bar.slideIndex.set(withSpring(index, SLIDE_SPRING))
        setMinimized(minimized, 0)
        onPress?.(event)
      }}
      style={styles.item}
    >
      <View>
        {item.renderIcon({ tint: inactiveTint, size: ICON_SIZE })}
        <Animated.View style={[StyleSheet.absoluteFill, styles.center, activeGlyphStyle]}>
          {item.renderIcon({ tint: activeTint, size: ICON_SIZE })}
        </Animated.View>
      </View>
      <Animated.Text numberOfLines={1} maxFontSizeMultiplier={1.15} style={[styles.label, labelStyle]}>
        {item.label}
      </Animated.Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  host: { position: "absolute", left: 0, right: 0, bottom: 0 },
  center: { alignItems: "center", justifyContent: "center" },
  bar: { borderCurve: "continuous" },
  capsule: { borderRadius: 999, borderCurve: "continuous", overflow: "hidden" },
  shadow: {
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  smoke: { backgroundColor: "rgba(18, 18, 20, 0.4)" },
  chip: { position: "absolute", left: 0, top: ROW_PAD, borderCurve: "continuous", borderWidth: StyleSheet.hairlineWidth },
  row: { flex: 1, flexDirection: "row", alignItems: "center", paddingHorizontal: ROW_PAD },
  item: { flex: 1, alignSelf: "stretch", alignItems: "center", justifyContent: "center", overflow: "hidden" },
  label: { fontSize: LABEL_SIZE, lineHeight: LABEL_BLOCK, fontWeight: "600", marginTop: 2 },
})
