import type { BottomTabBarProps } from "@react-navigation/bottom-tabs"
import type { SFSymbol } from "sf-symbols-typescript"
import * as Haptics from "expo-haptics"
import { useCallback, useMemo } from "react"
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { IconSymbol } from "@/components/ui/icon-symbol"
import {
  LiquidGlassFallback,
  liquidGlassFallbackFill,
} from "@/components/ui/liquid-glass-fallback"
import { Colors, resolveColorScheme } from "@/constants/theme"
import {
  PlayTTFontFamilies,
  PlayTTRadius,
  PlayTTSpacing,
} from "@/constants/playtt-tokens"
import { ProductThemes } from "@/constants/product-theme"
import { useColorScheme } from "@/hooks/use-color-scheme"
import { getGlassTabBarSwift } from "@/lib/load-expo-ui"
import { TAB_SYSTEM_ICONS } from "@/lib/liquid-glass"

const VISIBLE_TAB_NAMES = [
  "index",
  "bookings",
  "activity",
  "community",
  "account",
] as const

const TAB_ICON_SIZE = 22

type TabBarOptions = {
  title?: string
  tabBarIcon?: (props: {
    focused: boolean
    color: string
    size: number
  }) => React.ReactNode
}

function isVisibleTab(routeName: string): routeName is (typeof VISIBLE_TAB_NAMES)[number] {
  return (VISIBLE_TAB_NAMES as readonly string[]).includes(routeName)
}

function getTabSystemIcon(routeName: (typeof VISIBLE_TAB_NAMES)[number]): SFSymbol {
  return TAB_SYSTEM_ICONS[routeName]
}

export function GlassTabBar(props: BottomTabBarProps) {
  const SwiftTabBar = getGlassTabBarSwift()
  if (SwiftTabBar) {
    return <SwiftTabBar {...props} />
  }

  return <GlassTabBarFallback {...props} />
}

function GlassTabBarFallback({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets()
  const colorScheme = resolveColorScheme(useColorScheme())
  const palette = Colors[colorScheme]
  const productTheme = ProductThemes[colorScheme]

  const visibleRoutes = useMemo(
    () =>
      state.routes.filter(
        (route): route is (typeof state.routes)[number] & {
          name: (typeof VISIBLE_TAB_NAMES)[number]
        } => isVisibleTab(route.name),
      ),
    [state.routes],
  )

  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrapper: {
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          paddingHorizontal: PlayTTSpacing.sm,
          paddingTop: PlayTTSpacing.xs,
        },
        pill: {
          borderRadius: PlayTTRadius.panel,
          overflow: "hidden",
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: productTheme.border,
          ...Platform.select({
            ios: {
              shadowColor: colorScheme === "dark" ? "#020810" : "#0a1628",
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: colorScheme === "dark" ? 0.45 : 0.12,
              shadowRadius: 24,
            },
            android: {
              elevation: 12,
            },
            default: {},
          }),
        },
        row: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-around",
          paddingVertical: PlayTTSpacing.xs,
          paddingHorizontal: PlayTTSpacing.xs,
          minHeight: 54,
        },
        tab: {
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          paddingVertical: PlayTTSpacing.xs,
        },
        tabInner: {
          alignItems: "center",
          justifyContent: "center",
          gap: 2,
          paddingHorizontal: 4,
          paddingVertical: PlayTTSpacing.xs,
          borderRadius: PlayTTRadius.lg,
        },
        tabInnerActive: {
          backgroundColor:
            colorScheme === "dark"
              ? "rgba(255, 255, 255, 0.08)"
              : "rgba(10, 22, 40, 0.06)",
        },
        label: {
          fontSize: 10,
          fontFamily: PlayTTFontFamilies.medium,
          color: palette.tabIconDefault,
          textAlign: "center",
        },
        labelActive: {
          fontSize: 10,
          fontFamily: PlayTTFontFamilies.semiBold,
          color: palette.tabIconSelected,
        },
      }),
    [colorScheme, palette.tabIconDefault, palette.tabIconSelected, productTheme.border],
  )

  const bottomPadding = Math.max(insets.bottom, PlayTTSpacing.sm)

  const handleTabPress = useCallback(
    (routeKey: string, routeName: string, routeParams: object | undefined, isFocused: boolean) => {
      if (process.env.EXPO_OS === "ios") {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      }

      const event = navigation.emit({
        type: "tabPress",
        target: routeKey,
        canPreventDefault: true,
      })

      if (!isFocused && !event.defaultPrevented) {
        navigation.navigate(routeName, routeParams)
      }
    },
    [navigation],
  )

  const handleTabLongPress = useCallback(
    (routeKey: string) => {
      navigation.emit({
        type: "tabLongPress",
        target: routeKey,
      })
    },
    [navigation],
  )

  return (
    <View style={[styles.wrapper, { paddingBottom: bottomPadding }]}>
      <View style={styles.pill}>
        <LiquidGlassFallback
          colorScheme={colorScheme}
          intensity={80}
          style={liquidGlassFallbackFill}
        />

        <View style={styles.row}>
          {visibleRoutes.map((route) => {
            const routeIndex = state.routes.indexOf(route)
            const { options } = descriptors[route.key]
            const tabOptions = options as TabBarOptions
            const label = tabOptions.title ?? route.name
            const isFocused = state.index === routeIndex

            const iconColor = isFocused
              ? palette.tabIconSelected
              : palette.tabIconDefault

            return (
              <Pressable
                key={route.key}
                accessibilityRole="button"
                accessibilityState={isFocused ? { selected: true } : {}}
                accessibilityLabel={label}
                onPress={() =>
                  handleTabPress(route.key, route.name, route.params, isFocused)
                }
                onLongPress={() => handleTabLongPress(route.key)}
                style={styles.tab}
              >
                <View style={[styles.tabInner, isFocused && styles.tabInnerActive]}>
                  {tabOptions.tabBarIcon?.({
                    focused: isFocused,
                    color: iconColor,
                    size: TAB_ICON_SIZE,
                  }) ?? (
                    <IconSymbol
                      size={TAB_ICON_SIZE}
                      name={getTabSystemIcon(route.name)}
                      color={iconColor}
                    />
                  )}
                  <Text
                    style={[styles.label, isFocused && styles.labelActive]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.85}
                  >
                    {label}
                  </Text>
                </View>
              </Pressable>
            )
          })}
        </View>
      </View>
    </View>
  )
}
