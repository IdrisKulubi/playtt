import { useMinimizeOnScroll } from "expo-glass-tabs"
import { useState, type ReactElement, type ReactNode } from "react"
import {
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type RefreshControlProps,
  type StyleProp,
  type ViewStyle,
} from "react-native"
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useComposedEventHandler,
  useReducedMotion,
  useSharedValue,
} from "react-native-reanimated"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { PressableScale } from "@/components/kit/pressable-scale"
import { AppText } from "@/components/ui/app-text"
import { IconSymbol } from "@/components/ui/icon-symbol"
import { LiquidGlassSurface } from "@/components/ui/liquid-glass-surface"
import { KitLayout } from "@/constants/kit-layout"
import { getFloatingTabBarInset } from "@/constants/navigation-layout"
import { PlayTTSpacing } from "@/constants/playtt-tokens"
import { useAppTheme } from "@/hooks/use-app-theme"

const NAV_BAR_HEIGHT = 44
/** Scroll distance over which the nav bar material fades in. */
const BAR_FADE_DISTANCE = 12

type ScreenProps = {
  /** Matches the tab label or the row that opened this screen. */
  title: string
  /** One line under the large title, e.g. the venue name. */
  subtitle?: string
  /** Pushed screens: the back button names where it goes ("Me"). */
  back?: { label: string; onPress: () => void }
  /** Small actions in the nav bar. Each needs a visible label or accessibilityLabel. */
  headerRight?: ReactNode
  /** Sticky bottom bar, e.g. price + Continue. Sits on glass above content. */
  footer?: ReactNode
  /** Tab screens add tab-bar clearance and minimize the bar on scroll. */
  inTabs?: boolean
  refreshControl?: ReactElement<RefreshControlProps>
  contentContainerStyle?: StyleProp<ViewStyle>
  children: ReactNode
}

/**
 * Screen scaffold for redesigned UI: a large title in the content that
 * collapses into a glass nav bar as you scroll. No divider under the bar —
 * the material fades in only once content is underneath it.
 */
export function Screen({
  title,
  subtitle,
  back,
  headerRight,
  footer,
  inTabs = false,
  refreshControl,
  contentContainerStyle,
  children,
}: ScreenProps) {
  const insets = useSafeAreaInsets()
  const { scheme, colors } = useAppTheme()
  const reducedMotion = useReducedMotion()
  const scrollY = useSharedValue(0)
  const titleBottom = useSharedValue(48)
  const [footerHeight, setFooterHeight] = useState(0)

  const minimizeTabBar = useMinimizeOnScroll()
  const trackScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.set(event.contentOffset.y)
    },
  })
  const onScroll = useComposedEventHandler(inTabs ? [trackScroll, minimizeTabBar] : [trackScroll])

  const barStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      scrollY.get(),
      [titleBottom.get() - BAR_FADE_DISTANCE, titleBottom.get()],
      [0, 1],
      Extrapolation.CLAMP,
    ),
  }))

  // Pull-down stretches the large title slightly, like iOS.
  const largeTitleStyle = useAnimatedStyle(() => ({
    transform: [
      {
        scale: reducedMotion
          ? 1
          : interpolate(scrollY.get(), [-120, 0], [1.08, 1], Extrapolation.CLAMP),
      },
    ],
  }))

  const topInset = insets.top + NAV_BAR_HEIGHT
  const bottomInset =
    (inTabs ? getFloatingTabBarInset(insets.bottom) : insets.bottom) +
    footerHeight +
    PlayTTSpacing.lg

  const onTitleLayout = (event: LayoutChangeEvent) => {
    const { y, height } = event.nativeEvent.layout
    titleBottom.set(y + height)
  }

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
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View onLayout={onTitleLayout} style={[styles.largeTitle, largeTitleStyle]}>
          <AppText variant="largeTitle" accessibilityRole="header">
            {title}
          </AppText>
          {subtitle ? (
            <AppText variant="subheadline" color="secondaryLabel">
              {subtitle}
            </AppText>
          ) : null}
        </Animated.View>
        {children}
      </Animated.ScrollView>

      <View style={[styles.navBar, { height: topInset, paddingTop: insets.top }]}>
        <Animated.View style={[StyleSheet.absoluteFill, barStyle]} pointerEvents="none">
          <LiquidGlassSurface colorScheme={scheme} style={StyleSheet.absoluteFill} />
        </Animated.View>

        <View style={styles.navSide}>
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
          style={[styles.navTitle, barStyle]}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <AppText variant="headline" numberOfLines={1} maxFontSizeMultiplier={1.3}>
            {title}
          </AppText>
        </Animated.View>

        <View style={[styles.navSide, styles.navRight]}>{headerRight}</View>
      </View>

      {footer ? (
        <View
          onLayout={(event) => setFooterHeight(event.nativeEvent.layout.height)}
          style={[
            styles.footer,
            {
              paddingBottom:
                (inTabs ? getFloatingTabBarInset(insets.bottom) : insets.bottom) + PlayTTSpacing.sm,
            },
          ]}
        >
          <LiquidGlassSurface colorScheme={scheme} style={StyleSheet.absoluteFill} />
          {footer}
        </View>
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
  largeTitle: {
    transformOrigin: "left",
    gap: PlayTTSpacing["2xs"],
  },
  navBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: PlayTTSpacing.xs,
  },
  navSide: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  navRight: { justifyContent: "flex-end", gap: PlayTTSpacing.xs },
  navTitle: {
    flex: 2,
    alignItems: "center",
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: NAV_BAR_HEIGHT,
    paddingRight: PlayTTSpacing.xs,
  },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: PlayTTSpacing.sm,
    paddingHorizontal: KitLayout.screenGutter,
    overflow: "hidden",
  },
})
