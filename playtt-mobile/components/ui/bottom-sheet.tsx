import { type ReactNode, useEffect, useMemo } from "react"
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native"
import { Gesture, GestureDetector } from "react-native-gesture-handler"
import Animated, {
  FadeIn,
  FadeOut,
  runOnJS,
  SlideInDown,
  SlideOutDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
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

  useEffect(() => {
    if (visible) {
      translateY.value = 0
    }
  }, [visible, translateY])

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

  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      if (event.translationY > 0) {
        translateY.value = event.translationY
      }
    })
    .onEnd((event) => {
      if (
        event.translationY > DISMISS_DRAG_THRESHOLD ||
        event.velocityY > DISMISS_VELOCITY_THRESHOLD
      ) {
        translateY.value = 0
        runOnJS(onClose)()
        return
      }

      translateY.value = withSpring(0, { damping: 20, stiffness: 220 })
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
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <Animated.View
          entering={FadeIn.duration(180)}
          exiting={FadeOut.duration(140)}
          style={StyleSheet.absoluteFill}
        >
          <Pressable style={styles.backdrop} onPress={onClose} />
        </Animated.View>

        <GestureDetector gesture={panGesture}>
          <Animated.View
            entering={SlideInDown.duration(260)}
            exiting={SlideOutDown.duration(200)}
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
      </View>
    </Modal>
  )
}
