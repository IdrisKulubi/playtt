import { useMinimizeOnScroll } from "expo-glass-tabs"
import { useState, type ReactElement, type ReactNode } from "react"
import {
  StyleSheet,
  View,
  type RefreshControlProps,
  type StyleProp,
  type ViewStyle,
} from "react-native"
import Animated, {
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useComposedEventHandler,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { EdgeBackdrop, EdgeFade } from "@/components/kit/edge-fade"
import {
  HeaderBar,
  LargeTitle,
  useCollapsingHeader,
  useHeaderContentInset,
} from "@/components/kit/collapsing-header"
import { FADE_QUICK, spring } from "@/constants/motion"
import { KitLayout } from "@/constants/kit-layout"
import { getFloatingTabBarInset } from "@/constants/navigation-layout"
import { PlayTTSpacing } from "@/constants/playtt-tokens"
import { useAppTheme } from "@/hooks/use-app-theme"

/** How far the fade above a footer reaches, and how dark the footer is. */
const FOOTER_FADE_HEIGHT = 72
const FOOTER_DARKNESS = 0.96

type ScreenProps = {
  /** Matches the tab label or the row that opened this screen. */
  title: string
  /** One line under the large title, e.g. today's date or the venue. */
  subtitle?: string
  /** Pushed screens: the back button names where it goes ("Me"). */
  back?: { label: string; onPress: () => void }
  /** Small actions in the top bar. Each needs a visible label or accessibilityLabel. */
  headerRight?: ReactNode
  /** Pinned in the top-right corner and never scrolls, e.g. your photo. */
  cornerAccessory?: ReactNode
  /** Sticky bottom bar, e.g. price + Continue. Sits on glass above content. */
  footer?: ReactNode
  /**
   * Hide the footer until the content has scrolled this far (pt), then float it
   * up; scrolling back above that point tucks it away again.
   */
  footerRevealOffset?: number
  /** Tab screens add tab-bar clearance and minimize the bar on scroll. */
  inTabs?: boolean
  refreshControl?: ReactElement<RefreshControlProps>
  contentContainerStyle?: StyleProp<ViewStyle>
  children: ReactNode
}

/**
 * Screen scaffold for redesigned UI, with the iOS 26 header: a large title
 * that hands over to a small centred title as you scroll, and content that
 * slides softly under the top edge (see `collapsing-header.tsx`).
 */
export function Screen({
  title,
  subtitle,
  back,
  headerRight,
  cornerAccessory,
  footer,
  footerRevealOffset,
  inTabs = false,
  refreshControl,
  contentContainerStyle,
  children,
}: ScreenProps) {
  const insets = useSafeAreaInsets()
  const { scheme, colors } = useAppTheme()
  const [footerHeight, setFooterHeight] = useState(0)
  const header = useCollapsingHeader()
  const topInset = useHeaderContentInset(Boolean(back))

  const minimizeTabBar = useMinimizeOnScroll()
  const onScroll = useComposedEventHandler(
    inTabs ? [header.trackScroll, minimizeTabBar] : [header.trackScroll]
  )

  const reducedMotion = useReducedMotion()
  const reveals = footerRevealOffset !== undefined
  const shown = useSharedValue(reveals ? 0 : 1)
  const [footerActive, setFooterActive] = useState(!reveals)
  useAnimatedReaction(
    () =>
      footerRevealOffset === undefined
        ? true
        : header.scrollY.get() > footerRevealOffset,
    (visible, previous) => {
      if (visible === previous) return
      shown.set(
        reducedMotion
          ? withTiming(visible ? 1 : 0, FADE_QUICK)
          : withSpring(visible ? 1 : 0, spring("default"))
      )
      runOnJS(setFooterActive)(visible)
    },
    [footerRevealOffset, reducedMotion]
  )
  const footerStyle = useAnimatedStyle(() => ({
    opacity: Math.min(Math.max(shown.get(), 0), 1),
    transform: [
      {
        translateY: reducedMotion ? 0 : (1 - shown.get()) * (footerHeight + 40),
      },
    ],
  }))

  const bottomInset =
    (inTabs ? getFloatingTabBarInset(insets.bottom) : insets.bottom) +
    footerHeight +
    PlayTTSpacing.lg

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        refreshControl={refreshControl}
        contentContainerStyle={[
          styles.content,
          { paddingTop: topInset, paddingBottom: bottomInset },
          contentContainerStyle,
        ]}
        showsVerticalScrollIndicator={false}
        // "handled" keeps a tap on another field from blurring and flickering the keyboard.
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets
      >
        <LargeTitle
          title={title}
          subtitle={subtitle}
          scrollY={header.scrollY}
          titleHeight={header.titleHeight}
          onLayout={header.onTitleLayout}
          reserveCorner={Boolean(cornerAccessory)}
        />
        {children}
      </Animated.ScrollView>

      <HeaderBar
        title={title}
        subtitle={subtitle}
        scrollY={header.scrollY}
        titleHeight={header.titleHeight}
        back={back}
        headerRight={headerRight}
        cornerAccessory={cornerAccessory}
      />

      {footer ? (
        <Animated.View
          onLayout={(event) => setFooterHeight(event.nativeEvent.layout.height)}
          pointerEvents={footerActive ? "box-none" : "none"}
          style={[
            styles.footer,
            footerStyle,
            {
              paddingBottom:
                (inTabs
                  ? getFloatingTabBarInset(insets.bottom)
                  : insets.bottom) + PlayTTSpacing.sm,
            },
          ]}
        >
          {/* No bar edge: a solid base, and a fade rising from its top that
              meets it at the same darkness, so content just sinks in. */}
          <EdgeBackdrop
            color={colors.background}
            scheme={scheme}
            darkness={FOOTER_DARKNESS}
          />
          <EdgeFade
            edge="bottom"
            height={FOOTER_FADE_HEIGHT}
            color={colors.background}
            scheme={scheme}
            darkness={FOOTER_DARKNESS}
            style={{ bottom: footerHeight }}
          />
          {footer}
        </Animated.View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: {
    paddingHorizontal: KitLayout.screenGutter,
    gap: PlayTTSpacing.lg,
  },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: PlayTTSpacing.sm,
    paddingHorizontal: KitLayout.screenGutter,
  },
})
