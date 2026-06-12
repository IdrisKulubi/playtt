import { useMemo } from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"

import { IconSymbol } from "@/components/ui/icon-symbol"
import {
  PlayTTFontFamilies,
  PlayTTSpacing,
} from "@/constants/playtt-tokens"
import { useProductTheme } from "@/hooks/use-product-theme"
import type { MockReplay } from "@/lib/mock/mock-replays"

type ReplayListRowProps = {
  replay: MockReplay
  onPress: () => void
  isLast?: boolean
}

export function ReplayListRow({
  replay,
  onPress,
  isLast = false,
}: ReplayListRowProps) {
  const theme = useProductTheme()

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          paddingVertical: PlayTTSpacing.md,
          borderBottomWidth: isLast ? 0 : StyleSheet.hairlineWidth,
          borderBottomColor: theme.border,
        },
        pressed: {
          opacity: 0.7,
        },
        row: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: PlayTTSpacing.sm,
        },
        copy: {
          flex: 1,
          gap: 2,
        },
        title: {
          fontSize: 16,
          fontFamily: PlayTTFontFamilies.medium,
          color: theme.foreground,
        },
        meta: {
          fontSize: 13,
          fontFamily: PlayTTFontFamilies.regular,
          color: theme.muted,
        },
      }),
    [isLast, theme],
  )

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.container, pressed && styles.pressed]}
    >
      <View style={styles.row}>
        <View style={styles.copy}>
          <Text style={styles.title}>{replay.title}</Text>
          <Text style={styles.meta}>
            {replay.durationSeconds}s ·{" "}
            {new Date(replay.recordedAt).toLocaleDateString("en-KE", {
              day: "numeric",
              month: "short",
            })}
            {replay.coachReviewed ? " · Reviewed" : ""}
          </Text>
        </View>
        <IconSymbol name="chevron.right" size={18} color={theme.muted} />
      </View>
    </Pressable>
  )
}
