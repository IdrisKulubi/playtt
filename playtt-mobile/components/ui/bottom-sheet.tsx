import { type ReactNode, useMemo } from "react"
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native"
import Animated, {
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown,
} from "react-native-reanimated"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import {
  PlayTTFontFamilies,
  PlayTTRadius,
  PlayTTSpacing,
} from "@/constants/playtt-tokens"
import { useProductTheme } from "@/hooks/use-product-theme"

type BottomSheetProps = {
  visible: boolean
  title: string
  onClose: () => void
  children: ReactNode
}

export function BottomSheet({
  visible,
  title,
  onClose,
  children,
}: BottomSheetProps) {
  const insets = useSafeAreaInsets()
  const theme = useProductTheme()
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
      }),
    [theme],
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

        <Animated.View
          entering={SlideInDown.duration(260)}
          exiting={SlideOutDown.duration(200)}
          style={[
            styles.sheet,
            { paddingBottom: Math.max(insets.bottom, PlayTTSpacing.md) },
          ]}
        >
          <View style={styles.handle} />
          <Text style={styles.title}>{title}</Text>
          {children}
        </Animated.View>
      </View>
    </Modal>
  )
}
