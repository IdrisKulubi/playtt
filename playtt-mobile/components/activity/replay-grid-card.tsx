import { useMemo } from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"

import { ReplayThumb } from "@/components/activity/replay-thumb"
import { IconSymbol } from "@/components/ui/icon-symbol"
import {
  PlayTTColors,
  PlayTTFontFamilies,
  PlayTTSpacing,
} from "@/constants/playtt-tokens"
import { useProductTheme } from "@/hooks/use-product-theme"
import type { ReplaySummary } from "@/lib/replay-types"

type ReplayGridCardProps = {
  replay: ReplaySummary
  selected: boolean
  onSelect: () => void
  onPlay: () => void
  onMenu: () => void
}

function formatRecordedDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-KE", {
    day: "numeric",
    month: "short",
  })
}

export function ReplayGridCard({
  replay,
  selected,
  onSelect,
  onPlay,
  onMenu,
}: ReplayGridCardProps) {
  const theme = useProductTheme()

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: {
          gap: PlayTTSpacing.xs,
        },
        thumbShell: {
          borderRadius: 12,
          borderWidth: selected ? 2 : StyleSheet.hairlineWidth,
          borderColor: selected
            ? PlayTTColors.primary
            : "rgba(255, 255, 255, 0.08)",
          overflow: "hidden",
        },
        thumbInner: {
          borderRadius: selected ? 10 : 12,
          borderWidth: 0,
        },
        footer: {
          flexDirection: "row",
          alignItems: "flex-start",
          gap: PlayTTSpacing["2xs"],
        },
        copyPressable: {
          flex: 1,
          gap: 2,
        },
        titleRow: {
          flexDirection: "row",
          alignItems: "center",
          gap: 4,
        },
        title: {
          flex: 1,
          fontSize: 14,
          fontFamily: PlayTTFontFamilies.semiBold,
          color: theme.foreground,
        },
        meta: {
          fontSize: 12,
          fontFamily: PlayTTFontFamilies.regular,
          color: theme.muted,
        },
        menuHit: {
          padding: PlayTTSpacing["2xs"],
          marginTop: -2,
          marginRight: -4,
        },
        pressed: {
          opacity: 0.88,
        },
      }),
    [selected, theme],
  )

  return (
    <View style={styles.root}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Select ${replay.title}`}
        accessibilityState={{ selected }}
        onPress={onSelect}
        style={({ pressed }) => [pressed && styles.pressed]}
      >
        <View style={styles.thumbShell}>
          <ReplayThumb
            durationSeconds={replay.durationSeconds}
            aspectRatio={4 / 5}
            style={styles.thumbInner}
            onPlayPress={onPlay}
          />
        </View>
      </Pressable>
      <View style={styles.footer}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Select ${replay.title}`}
          accessibilityState={{ selected }}
          onPress={onSelect}
          style={({ pressed }) => [
            styles.copyPressable,
            pressed && styles.pressed,
          ]}
        >
          <View style={styles.titleRow}>
            {replay.isFavorite ? (
              <IconSymbol name="star.fill" size={14} color={PlayTTColors.primary} />
            ) : null}
            <Text style={styles.title} numberOfLines={1}>
              {replay.title}
            </Text>
          </View>
          <Text style={styles.meta} numberOfLines={1}>
            {formatRecordedDate(replay.recordedAt)}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Clip options"
          onPress={onMenu}
          hitSlop={8}
          style={({ pressed }) => [
            styles.menuHit,
            pressed && styles.pressed,
          ]}
        >
          <IconSymbol name="ellipsis" size={20} color={theme.muted} />
        </Pressable>
      </View>
    </View>
  )
}
