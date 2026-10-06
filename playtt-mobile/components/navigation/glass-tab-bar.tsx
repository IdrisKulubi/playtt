import type { BottomTabBarProps } from "expo-router/js-tabs"
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

import {
  TabBarGlassSurface,
  tabBarGlassFill,
  useNativeTabBarGlass,
} from "@/components/navigation/tab-bar-glass-surface"
import { IconSymbol } from "@/components/ui/icon-symbol"
import {
  liquidGlassLabelColor,
  liquidGlassPillBorderColor,
  liquidGlassSelectionChipColor,
} from "@/components/ui/liquid-glass-chrome"
import { resolveColorScheme } from "@/constants/theme"
import {
  PlayTTFontFamilies,
  PlayTTRadius,
  PlayTTSpacing,
} from "@/constants/playtt-tokens"
import { useColorScheme } from "@/hooks/use-color-scheme"

const VISIBLE_TAB_NAMES = [
  "index",
  "bookings",
  "activity",
  "community",
  "account",
] as const

const TAB_ICON_SIZE = 22

const TAB_SYSTEM_ICONS = {
  index: "house.fill",
  bookings: "calendar",
  activity: "chart.bar.fill",
  community: "person.2.fill",
  account: "person.fill",
} as const

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

export function GlassTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets()
  const colorScheme = resolveColorScheme(useColorScheme())
  const nativeGlass = useNativeTabBarGlass()

  const visibleRoutes = useMemo(
    () =>
      state.routes.filter(
        (route): route is (typeof state.routes)[number] & {
          name: (typeof VISIBLE_TAB_NAMES)[number]
        } => isVisibleTab(route.name),
      ),
    [state],
  )

  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrapper: {
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          paddingHorizontal: PlayTTSpacing.md,
          paddingTop: PlayTTSpacing.xs,
        },
        pill: {
          borderRadius: PlayTTRadius.pill,
          overflow: "hidden",
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: liquidGlassPillBorderColor(colorScheme),
          ...(!nativeGlass
            ? Platform.select({
                ios: {
                  shadowColor: colorScheme === "dark" ? "#000000" : "#0a1628",
                  shadowOffset: { width: 0, height: 6 },
                  shadowOpacity: colorScheme === "dark" ? 0.35 : 0.1,
                  shadowRadius: 16,
                },
                android: {
                  elevation: 10,
                },
                default: {},
              })
            : {}),
        },
        row: {
          flexDirection: "row",
          alignItems: "stretch",
          justifyContent: "space-between",
          paddingVertical: 5,
          paddingHorizontal: 4,
          minHeight: 56,
        },
        tab: {
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
        },
        chip: {
          alignItems: "center",
          justifyContent: "center",
          paddingVertical: 6,
          paddingHorizontal: 6,
          borderRadius: 22,
          minWidth: 52,
          minHeight: 46,
        },
        chipActive: {
          backgroundColor: liquidGlassSelectionChipColor(colorScheme),
        },
        label: {
          marginTop: 3,
          fontSize: 10,
          fontFamily: PlayTTFontFamilies.medium,
          textAlign: "center",
        },
      }),
    [colorScheme, nativeGlass],
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
        <TabBarGlassSurface colorScheme={colorScheme} style={tabBarGlassFill} />

        <View style={styles.row}>
          {visibleRoutes.map((route) => {
            const routeIndex = state.routes.indexOf(route)
            const { options } = descriptors[route.key]
            const tabOptions = options as TabBarOptions
            const label = tabOptions.title ?? route.name
            const isFocused = state.index === routeIndex

            const iconColor = liquidGlassLabelColor(colorScheme, isFocused)
            const labelColor = iconColor

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
                <View style={[styles.chip, isFocused && styles.chipActive]}>
                  {tabOptions.tabBarIcon?.({
                    focused: isFocused,
                    color: iconColor,
                    size: TAB_ICON_SIZE,
                  }) ?? (
                    <IconSymbol
                      size={TAB_ICON_SIZE}
                      name={TAB_SYSTEM_ICONS[route.name]}
                      color={iconColor}
                    />
                  )}
                  <Text
                    style={[styles.label, { color: labelColor }]}
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
