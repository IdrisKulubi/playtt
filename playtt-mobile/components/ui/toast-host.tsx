import { useEffect, useMemo, useState } from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"
import Animated, {
  Easing,
  FadeInUp,
  FadeOutUp,
} from "react-native-reanimated"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { IconSymbol } from "@/components/ui/icon-symbol"
import {
  PlayTTColors,
  PlayTTElevation,
  PlayTTFontFamilies,
  PlayTTRadius,
  PlayTTSpacing,
} from "@/constants/playtt-tokens"
import { useColorScheme } from "@/hooks/use-color-scheme"
import { useProductTheme } from "@/hooks/use-product-theme"
import {
  setToastListener,
  type ToastPayload,
  type ToastVariant,
} from "@/lib/toast"

const TOAST_DURATION_MS = 4200
const ENTER_MS = 240
const EXIT_MS = 200

type ToastIconName =
  | "checkmark.circle.fill"
  | "xmark.circle.fill"
  | "info.circle.fill"

type VariantConfig = {
  icon: ToastIconName
  iconColor: string
  iconBackground: string
}

function getVariantConfig(
  variant: ToastVariant,
  isDark: boolean,
): VariantConfig {
  switch (variant) {
    case "success":
      return {
        icon: "checkmark.circle.fill",
        iconColor: isDark ? "#5ee6a0" : "#0f9d58",
        iconBackground: isDark
          ? "rgba(94, 230, 160, 0.12)"
          : "rgba(15, 157, 88, 0.1)",
      }
    case "error":
      return {
        icon: "xmark.circle.fill",
        iconColor: isDark ? "#ff6961" : PlayTTColors.destructive,
        iconBackground: isDark
          ? "rgba(255, 105, 97, 0.12)"
          : "rgba(255, 59, 48, 0.08)",
      }
    case "info":
      return {
        icon: "info.circle.fill",
        iconColor: PlayTTColors.primary,
        iconBackground: isDark
          ? "rgba(0, 183, 255, 0.14)"
          : "rgba(0, 183, 255, 0.1)",
      }
  }
}

export function ToastHost() {
  const insets = useSafeAreaInsets()
  const theme = useProductTheme()
  const colorScheme = useColorScheme()
  const isDark = colorScheme === "dark"
  const [toast, setToast] = useState<ToastPayload | null>(null)

  const styles = useMemo(
    () =>
      StyleSheet.create({
        host: {
          position: "absolute",
          left: PlayTTSpacing.lg,
          right: PlayTTSpacing.lg,
          zIndex: 1000,
        },
        toast: {
          borderWidth: StyleSheet.hairlineWidth,
          borderRadius: PlayTTRadius.lg,
          paddingVertical: PlayTTSpacing.sm,
          paddingHorizontal: PlayTTSpacing.sm,
          flexDirection: "row",
          alignItems: "center",
          gap: PlayTTSpacing.sm,
          backgroundColor: theme.card,
          borderColor: theme.border,
          ...(isDark ? PlayTTElevation.soft : PlayTTElevation.productCard),
        },
        iconWrap: {
          width: 32,
          height: 32,
          borderRadius: PlayTTRadius.md,
          alignItems: "center",
          justifyContent: "center",
        },
        message: {
          flex: 1,
          color: theme.foreground,
          fontSize: 14,
          lineHeight: 20,
          fontFamily: PlayTTFontFamilies.medium,
        },
        dismiss: {
          width: 32,
          height: 32,
          alignItems: "center",
          justifyContent: "center",
        },
      }),
    [isDark, theme.border, theme.card, theme.foreground],
  )

  useEffect(() => {
    setToastListener((nextToast) => {
      setToast(nextToast)
    })

    return () => {
      setToastListener(null)
    }
  }, [])

  useEffect(() => {
    if (!toast) {
      return
    }

    const timeoutId = setTimeout(() => {
      setToast(null)
    }, TOAST_DURATION_MS)

    return () => {
      clearTimeout(timeoutId)
    }
  }, [toast])

  if (!toast) {
    return null
  }

  const variant = getVariantConfig(toast.variant, isDark)

  return (
    <View pointerEvents="box-none" style={[styles.host, { top: insets.top + 10 }]}>
      <Animated.View
        entering={FadeInUp.duration(ENTER_MS).easing(
          Easing.out(Easing.cubic),
        )}
        exiting={FadeOutUp.duration(EXIT_MS).easing(Easing.in(Easing.cubic))}
        style={styles.toast}
      >
        <View
          style={[
            styles.iconWrap,
            { backgroundColor: variant.iconBackground },
          ]}
        >
          <IconSymbol
            name={variant.icon}
            size={18}
            color={variant.iconColor}
          />
        </View>

        <Text style={styles.message} numberOfLines={3}>
          {toast.message}
        </Text>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss notification"
          hitSlop={6}
          onPress={() => setToast(null)}
          style={styles.dismiss}
        >
          <IconSymbol name="xmark" size={16} color={theme.muted} />
        </Pressable>
      </Animated.View>
    </View>
  )
}
