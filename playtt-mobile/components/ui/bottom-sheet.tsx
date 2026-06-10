import { type ReactNode, useCallback, useEffect, useMemo } from "react"
import {
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native"
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler"
import Animated, {
  Easing,
  FadeIn,
  runOnJS,
  SlideInDown,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { ProductThemes } from "@/constants/product-theme"
import {
  PlayTTFontFamilies,
  PlayTTRadius,
  PlayTTSpacing,
} from "@/constants/playtt-tokens"
import { useProductTheme } from "@/hooks/use-product-theme"

const DISMISS_DRAG_THRESHOLD = 120
const DISMISS_VELOCITY_THRESHOLD = 800
const DISMISS_DURATION_MS = 220
const SNAP_BACK_DURATION_MS = 200
const SMOOTH_EASING = Easing.out(Easing.cubic)
const SCREEN_HEIGHT = Dimensions.get("window").height

type BottomSheetSurface = "product" | "dark"

type BottomSheetProps = {
  visible: boolean
  title: string
  onClose: () => void
  children: ReactNode
  surface?: BottomSheetSurface
  scrollable?: boolean
}

export function BottomSheet({
  visible,
  title,
  onClose,
  children,
  surface = "product",
  scrollable = false,
}: BottomSheetProps) {
  const insets = useSafeAreaInsets()
  const productTheme = useProductTheme()
  const theme = surface === "dark" ? ProductThemes.dark : productTheme
  const translateY = useSharedValue(0)
  const isDismissing = useSharedValue(false)

  const completeDismiss = useCallback(() => {
    onClose()
  }, [onClose])

  const animateDismiss = useCallback(() => {
    if (isDismissing.value) {
      return
    }

    isDismissing.value = true
    translateY.value = withTiming(
      SCREEN_HEIGHT,
      { duration: DISMISS_DURATION_MS, easing: SMOOTH_EASING },
      (finished) => {
        if (finished) {
          runOnJS(completeDismiss)()
        }
      },
    )
  }, [completeDismiss, isDismissing, translateY])

  useEffect(() => {
    if (visible) {
      isDismissing.value = false
      translateY.value = 0
    }
  }, [visible, isDismissing, translateY])

  const styles = useMemo(
    () =>
      StyleSheet.create({
        overlay: {
          flex: 1,
          justifyContent: "flex-end",
        },
        backdrop: {
          flex: 1,
          backgroundColor: theme.backdrop,
        },
        sheet: {
          backgroundColor: theme.card,
          borderTopLeftRadius: PlayTTRadius.panel,
          borderTopRightRadius: PlayTTRadius.panel,
          paddingHorizontal: PlayTTSpacing.lg,
          paddingTop: PlayTTSpacing.sm,
          maxHeight: "88%",
        },
        dragArea: {
          paddingBottom: PlayTTSpacing.xs,
        },
        handle: {
          alignSelf: "center",
          width: 40,
          height: 4,
          borderRadius: PlayTTRadius.pill,
          backgroundColor: theme.border,
          marginBottom: PlayTTSpacing.md,
        },
        title: {
          fontSize: 18,
          fontFamily: PlayTTFontFamilies.semiBold,
          color: theme.foreground,
          textAlign: "center",
          marginBottom: PlayTTSpacing.md,
        },
        scrollContent: {
          paddingBottom: PlayTTSpacing.sm,
        },
      }),
    [theme],
  )

  const sheetAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }))

  const backdropAnimatedStyle = useAnimatedStyle(() => {
    const progress = Math.min(translateY.value / SCREEN_HEIGHT, 1)
    return { opacity: 1 - progress }
  })

  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      if (event.translationY > 0) {
        translateY.value = event.translationY
      }
    })
    .onEnd((event) => {
      const shouldDismiss =
        event.translationY > DISMISS_DRAG_THRESHOLD ||
        event.velocityY > DISMISS_VELOCITY_THRESHOLD

      if (shouldDismiss) {
        if (isDismissing.value) {
          return
        }

        isDismissing.value = true
        translateY.value = withTiming(
          SCREEN_HEIGHT,
          { duration: DISMISS_DURATION_MS, easing: SMOOTH_EASING },
          (finished) => {
            if (finished) {
              runOnJS(completeDismiss)()
            }
          },
        )
        return
      }

      translateY.value = withTiming(0, {
        duration: SNAP_BACK_DURATION_MS,
        easing: SMOOTH_EASING,
      })
    })

  const body = scrollable ? (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.scrollContent}
      bounces
    >
      {children}
    </ScrollView>
  ) : (
    children
  )

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={animateDismiss}
      statusBarTranslucent
    >
      <GestureHandlerRootView style={styles.overlay}>
        <Animated.View
          entering={FadeIn.duration(180)}
          style={[StyleSheet.absoluteFill, backdropAnimatedStyle]}
        >
          <Pressable style={styles.backdrop} onPress={animateDismiss} />
        </Animated.View>

        <GestureDetector gesture={panGesture}>
          <Animated.View
            entering={SlideInDown.duration(260)}
            style={[
              styles.sheet,
              sheetAnimatedStyle,
              { paddingBottom: Math.max(insets.bottom, PlayTTSpacing.md) },
            ]}
          >
            <View style={styles.dragArea}>
              <View style={styles.handle} />
              <Text style={styles.title}>{title}</Text>
            </View>
            {body}
          </Animated.View>
        </GestureDetector>
      </GestureHandlerRootView>
    </Modal>
  )
}
