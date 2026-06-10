import { useEffect, useMemo, useState } from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"
import Animated, { FadeInUp, FadeOutUp } from "react-native-reanimated"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import {
  PlayTTColors,
  PlayTTFontFamilies,
  PlayTTRadius,
  PlayTTSpacing,
} from "@/constants/playtt-tokens"
import { useProductTheme } from "@/hooks/use-product-theme"
import {
  setToastListener,
  type ToastPayload,
  type ToastVariant,
} from "@/lib/toast"

const TOAST_DURATION_MS = 4200

function getVariantStyles(
  variant: ToastVariant,
  cardBackground: string,
): { backgroundColor: string; borderColor: string; accentColor: string } {
  switch (variant) {
    case "error":
      return {
        backgroundColor: "#2a1418",
        borderColor: "rgba(255, 59, 48, 0.45)",
        accentColor: PlayTTColors.destructive,
      }
    case "success":
      return {
        backgroundColor: "#10241a",
        borderColor: "rgba(0, 255, 102, 0.35)",
        accentColor: PlayTTColors.success,
      }
    case "info":
      return {
        backgroundColor: cardBackground,
        borderColor: "rgba(0, 183, 255, 0.35)",
        accentColor: PlayTTColors.primary,
      }
  }
}

export function ToastHost() {
  const insets = useSafeAreaInsets()
  const theme = useProductTheme()
  const [toast, setToast] = useState<ToastPayload | null>(null)

  const styles = useMemo(
    () =>
      StyleSheet.create({
        host: {
          position: "absolute",
          left: PlayTTSpacing.md,
          right: PlayTTSpacing.md,
          zIndex: 1000,
        },
        toast: {
          borderWidth: 1,
          borderRadius: PlayTTRadius.lg,
          paddingVertical: PlayTTSpacing.sm,
          paddingHorizontal: PlayTTSpacing.md,
          flexDirection: "row",
          alignItems: "flex-start",
          gap: PlayTTSpacing.sm,
          shadowColor: "#000",
          shadowOpacity: 0.22,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 8 },
          elevation: 8,
        },
        accent: {
          width: 4,
          alignSelf: "stretch",
          borderRadius: PlayTTRadius.pill,
          marginVertical: 2,
        },
        message: {
          flex: 1,
          color: theme.foreground,
          fontSize: 14,
          lineHeight: 20,
          fontFamily: PlayTTFontFamilies.medium,
        },
        dismiss: {
          paddingHorizontal: 2,
          marginTop: -2,
        },
        dismissLabel: {
          color: theme.muted,
          fontSize: 22,
          lineHeight: 22,
          fontFamily: PlayTTFontFamilies.regular,
        },
      }),
    [theme.foreground, theme.muted],
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

  const variantStyle = getVariantStyles(toast.variant, theme.card)

  return (
    <View pointerEvents="box-none" style={[styles.host, { top: insets.top + 8 }]}>
      <Animated.View
        entering={FadeInUp.duration(220)}
        exiting={FadeOutUp.duration(180)}
        style={[
          styles.toast,
          {
            backgroundColor: variantStyle.backgroundColor,
            borderColor: variantStyle.borderColor,
          },
        ]}
      >
        <View
          style={[styles.accent, { backgroundColor: variantStyle.accentColor }]}
        />
        <Text style={styles.message}>{toast.message}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss notification"
          hitSlop={8}
          onPress={() => setToast(null)}
          style={styles.dismiss}
        >
          <Text style={styles.dismissLabel}>×</Text>
        </Pressable>
      </Animated.View>
    </View>
  )
}
