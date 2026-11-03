import type { ReactNode } from "react"
import { StyleSheet, View, type LayoutChangeEvent } from "react-native"
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  type SharedValue,
} from "react-native-reanimated"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { EdgeFade } from "@/components/kit/edge-fade"
import { PressableScale } from "@/components/kit/pressable-scale"
import { AppText } from "@/components/ui/app-text"
import { IconSymbol } from "@/components/ui/icon-symbol"
import { KitLayout } from "@/constants/kit-layout"
import { PlayTTSpacing } from "@/constants/playtt-tokens"
import { useAppTheme } from "@/hooks/use-app-theme"

/**
 * The iOS 26 header: a large title on the left that, as you scroll, gives
 * way to a small centred title (with its subtitle) in the top bar. Content
 * slides under the top edge through a soft blur that darkens towards the
 * top, instead of meeting a hard bar. The corner accessory (your photo)
 * never moves.
 */

/** Height of the top bar row; fits a 48 pt photo with room to breathe. */
export const HEADER_ROW_HEIGHT = 60

/** How far the blur and darkening reach below the top bar. */
const FADE_BLEED = 64

/** Shared scroll state between the scroll view, large title and top bar. */
export function useCollapsingHeader() {
  const scrollY = useSharedValue(0)
  const titleHeight = useSharedValue(64)

  const trackScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.set(event.contentOffset.y)
    },
  })

  const onTitleLayout = (event: LayoutChangeEvent) => {
    titleHeight.set(event.nativeEvent.layout.height)
  }

  return { scrollY, titleHeight, trackScroll, onTitleLayout }
}

/**
 * Top padding for the scroll content. Tab screens start the large title
 * level with the top bar (beside the photo); pushed screens start it below
 * the back button.
 */
export function useHeaderContentInset(hasBack: boolean) {
  const insets = useSafeAreaInsets()
  return insets.top + (hasBack ? HEADER_ROW_HEIGHT : 0)
}

type LargeTitleProps = {
  title: string
  subtitle?: string
  scrollY: SharedValue<number>
  titleHeight: SharedValue<number>
  onLayout: (event: LayoutChangeEvent) => void
  /** Tab screens: leave room on the right for the pinned photo. */
  reserveCorner?: boolean
}

/** The big title in the content. It fades as it slides under the top bar. */
export function LargeTitle({ title, subtitle, scrollY, titleHeight, onLayout, reserveCorner }: LargeTitleProps) {
  const reducedMotion = useReducedMotion()

  const style = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.get(), [0, titleHeight.get() * 0.7], [1, 0], Extrapolation.CLAMP),
    // Pull-down stretches the title slightly, like iOS.
    transform: [
      { scale: reducedMotion ? 1 : interpolate(scrollY.get(), [-120, 0], [1.08, 1], Extrapolation.CLAMP) },
    ],
  }))

  return (
    <Animated.View
      onLayout={onLayout}
      style={[styles.largeTitle, reserveCorner && styles.reserveCorner, style]}
    >
      <AppText variant="largeTitle" accessibilityRole="header" numberOfLines={2}>
        {title}
      </AppText>
      {subtitle ? (
        <AppText variant="subheadline" color="secondaryLabel">
          {subtitle}
        </AppText>
      ) : null}
    </Animated.View>
  )
}

type HeaderBarProps = {
  title: string
  subtitle?: string
  scrollY: SharedValue<number>
  titleHeight: SharedValue<number>
  back?: { label: string; onPress: () => void }
  /** Small actions on the right. Each needs a label. */
  headerRight?: ReactNode
  /** Pinned in the top corner on every scroll position, e.g. your photo. */
  cornerAccessory?: ReactNode
}

/** The floating top bar: back button, small centred title, corner accessory. */
export function HeaderBar({ title, subtitle, scrollY, titleHeight, back, headerRight, cornerAccessory }: HeaderBarProps) {
  const insets = useSafeAreaInsets()
  const { colors } = useAppTheme()

  // Content is underneath: bring in the blur and darkening.
  const fadeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.get(), [0, 24], [0, 1], Extrapolation.CLAMP),
  }))

  // The small title arrives as the large one leaves, rising slightly into place.
  const compactStyle = useAnimatedStyle(() => {
    const height = titleHeight.get()
    const progress = interpolate(scrollY.get(), [height * 0.45, height * 0.9], [0, 1], Extrapolation.CLAMP)
    return {
      opacity: progress,
      transform: [{ translateY: (1 - progress) * 8 }, { scale: 0.94 + progress * 0.06 }],
    }
  })

  return (
    <View pointerEvents="box-none" style={[styles.bar, { paddingTop: insets.top }]}>
      <TopFade height={insets.top + HEADER_ROW_HEIGHT + FADE_BLEED} style={fadeStyle} />

      <View pointerEvents="box-none" style={styles.row}>
        <View pointerEvents="box-none" style={styles.side}>
          {back ? (
            <PressableScale
              onPress={back.onPress}
              accessibilityLabel={`Back to ${back.label}`}
              style={styles.backButton}
              hitSlop={8}
            >
              <IconSymbol name="chevron.left" size={22} color={colors.accentText} />
              <AppText variant="body" color="accentText" numberOfLines={1}>
                {back.label}
              </AppText>
            </PressableScale>
          ) : null}
        </View>

        {/* Duplicate of the large title, so screen readers skip it. */}
        <Animated.View
          pointerEvents="none"
          style={[styles.compactTitle, compactStyle]}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <AppText variant="headline" numberOfLines={1} maxFontSizeMultiplier={1.3}>
            {title}
          </AppText>
          {subtitle ? (
            <AppText variant="footnote" color="secondaryLabel" numberOfLines={1} maxFontSizeMultiplier={1.3}>
              {subtitle}
            </AppText>
          ) : null}
        </Animated.View>

        <View pointerEvents="box-none" style={[styles.side, styles.right]}>
          {headerRight}
          {cornerAccessory}
        </View>
      </View>
    </View>
  )
}

/** The page-level fade: content slides under the top edge of the screen. */
function TopFade({ height, style }: { height: number; style: ReturnType<typeof useAnimatedStyle> }) {
  const { scheme, colors } = useAppTheme()

  return (
    <Animated.View pointerEvents="none" style={[styles.fade, { height }, style]}>
      <EdgeFade edge="top" height={height} color={colors.background} scheme={scheme} />
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  bar: { position: "absolute", top: 0, left: 0, right: 0 },
  fade: { position: "absolute", top: 0, left: 0, right: 0 },
  row: {
    height: HEADER_ROW_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: PlayTTSpacing.xs,
  },
  side: { flex: 1, flexDirection: "row", alignItems: "center" },
  right: {
    justifyContent: "flex-end",
    gap: PlayTTSpacing.xs,
    paddingRight: KitLayout.screenGutter - PlayTTSpacing.xs,
  },
  compactTitle: { flex: 2, alignItems: "center" },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 44,
    paddingRight: PlayTTSpacing.xs,
  },
  largeTitle: {
    minHeight: HEADER_ROW_HEIGHT,
    justifyContent: "center",
    transformOrigin: "left",
    gap: PlayTTSpacing["2xs"],
  },
  // Keeps a long title from running under the pinned photo.
  reserveCorner: { paddingRight: 56 },
})
