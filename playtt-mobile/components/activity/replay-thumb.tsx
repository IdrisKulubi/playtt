import { useMemo } from "react"
import { Pressable, StyleSheet, Text, View, type ViewStyle } from "react-native"
import { Play } from "phosphor-react-native/src/icons/Play"

import {
  PlayTTColors,
  PlayTTFontFamilies,
  PlayTTRadius,
  PlayTTSpacing,
} from "@/constants/playtt-tokens"
import { useProductTheme } from "@/hooks/use-product-theme"

type ReplayThumbProps = {
  durationSeconds: number
  aspectRatio?: number
  style?: ViewStyle
  onPlayPress?: () => void
}

export function ReplayThumb({
  durationSeconds,
  aspectRatio = 16 / 9,
  style,
  onPlayPress,
}: ReplayThumbProps) {
  const theme = useProductTheme()

  const styles = useMemo(
    () =>
      StyleSheet.create({
        thumb: {
          width: "100%",
          aspectRatio,
          borderRadius: PlayTTRadius.lg,
          backgroundColor: theme.elevated,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: "rgba(255, 255, 255, 0.08)",
          overflow: "hidden",
          alignItems: "center",
          justifyContent: "center",
        },
        playCircle: {
          width: 44,
          height: 44,
          borderRadius: 22,
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
        playPressed: {
          opacity: 0.85,
        },
      }),
    [aspectRatio, theme],
  )

  return (
    <View style={[styles.thumb, style]} pointerEvents="box-none">
      {onPlayPress ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Play clip"
          onPress={onPlayPress}
          style={({ pressed }) => [
            styles.playCircle,
            pressed && styles.playPressed,
          ]}
        >
          <Play size={20} color={PlayTTColors.primary} weight="fill" />
        </Pressable>
      ) : (
        <View style={styles.playCircle}>
          <Play size={20} color={PlayTTColors.primary} weight="fill" />
        </View>
      )}
      <View style={styles.duration} pointerEvents="none">
        <Text style={styles.durationText}>{durationSeconds}s</Text>
      </View>
    </View>
  )
}
