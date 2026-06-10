import { useMemo } from "react"
import { Pressable, StyleSheet, Text, View, type ViewStyle } from "react-native"
import { Play } from "phosphor-react-native/src/icons/Play"

import {
  PlayTTColors,
  PlayTTFontFamilies,
  PlayTTSpacing,
} from "@/constants/playtt-tokens"
import { useProductTheme } from "@/hooks/use-product-theme"

type ReplayThumbProps = {
  durationSeconds: number
  aspectRatio?: number
  style?: ViewStyle
  onPress?: () => void
}

export function ReplayThumb({
  durationSeconds,
  aspectRatio = 16 / 9,
  style,
  onPress,
}: ReplayThumbProps) {
  const theme = useProductTheme()

  const styles = useMemo(
    () =>
      StyleSheet.create({
        thumb: {
          width: "100%",
          aspectRatio,
          borderRadius: 14,
          backgroundColor: theme.elevated,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: theme.border,
          overflow: "hidden",
          alignItems: "center",
          justifyContent: "center",
        },
        playCircle: {
          width: 52,
          height: 52,
          borderRadius: 26,
          backgroundColor: "rgba(4, 16, 25, 0.72)",
          alignItems: "center",
          justifyContent: "center",
          borderWidth: 1,
          borderColor: "rgba(0, 183, 255, 0.45)",
        },
        duration: {
          position: "absolute",
          right: PlayTTSpacing.sm,
          bottom: PlayTTSpacing.sm,
          paddingHorizontal: PlayTTSpacing.sm,
          paddingVertical: PlayTTSpacing["2xs"],
          borderRadius: 999,
          backgroundColor: "rgba(4, 16, 25, 0.78)",
        },
        durationText: {
          fontSize: 12,
          fontFamily: PlayTTFontFamilies.semiBold,
          color: theme.foreground,
        },
        pressed: {
          opacity: 0.85,
        },
      }),
    [aspectRatio, theme],
  )

  const content = (
    <>
      <View style={styles.playCircle}>
        <Play size={24} color={PlayTTColors.primary} weight="fill" />
      </View>
      <View style={styles.duration}>
        <Text style={styles.durationText}>{durationSeconds}s</Text>
      </View>
    </>
  )

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.thumb,
          style,
          pressed && styles.pressed,
        ]}
      >
        {content}
      </Pressable>
    )
  }

  return <View style={[styles.thumb, style]}>{content}</View>
}
