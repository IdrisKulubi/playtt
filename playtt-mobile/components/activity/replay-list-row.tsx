import { useMemo } from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"

import { GlassPanel } from "@/components/ui/glass-panel"
import { IconSymbol } from "@/components/ui/icon-symbol"
import {
  PlayTTFontFamilies,
  PlayTTSpacing,
} from "@/constants/playtt-tokens"
import { useProductTheme } from "@/hooks/use-product-theme"
import type { ReplaySummary } from "@/lib/replay-types"

type ReplayListRowProps = {
  replay: ReplaySummary
  onPress: () => void
}

export function ReplayListRow({ replay, onPress }: ReplayListRowProps) {
  const theme = useProductTheme()

  const styles = useMemo(
    () =>
      StyleSheet.create({
        pressed: {
          opacity: 0.85,
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
        panelContent: {
          paddingVertical: PlayTTSpacing.sm,
          paddingHorizontal: PlayTTSpacing.md,
        },
      }),
    [theme],
  )

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [pressed && styles.pressed]}
    >
      <GlassPanel contentStyle={styles.panelContent}>
        <View style={styles.row}>
          <View style={styles.copy}>
            <Text style={styles.title}>{replay.title}</Text>
            <Text style={styles.meta}>
              {replay.durationSeconds}s ·{" "}
              {new Date(replay.recordedAt).toLocaleDateString("en-KE", {
                day: "numeric",
                month: "short",
              })}
            </Text>
          </View>
          <IconSymbol
            name={replay.status === "ready" ? "play.circle.fill" : "chevron.right"}
            size={22}
            color={theme.muted}
          />
        </View>
      </GlassPanel>
    </Pressable>
  )
}
