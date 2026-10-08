import { useMemo } from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"

import { ReplayThumb } from "@/components/activity/replay-thumb"
import { IconSymbol } from "@/components/ui/icon-symbol"
import {
  PlayTTColors,
  PlayTTFontFamilies,
  PlayTTSpacing,
} from "@/constants/playtt-tokens"
import { useReplayPoster } from "@/hooks/use-replay-poster"
import { useProductTheme } from "@/hooks/use-product-theme"
import type { ReplaySummary } from "@/lib/replay-types"

type ReplayGridCardProps = {
  replay: ReplaySummary
  selected: boolean
  onSelect: () => void
  onPlay: () => void
  onMenu: () => void
}

const THUMB_ASPECT = 16 / 10
const THUMB_RADIUS = 16

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
  const posterUri = useReplayPoster(replay)

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: {
          gap: PlayTTSpacing.xs,
        },
        thumbShell: {
          borderRadius: THUMB_RADIUS,
          borderWidth: selected ? 2 : 0,
          borderColor: selected ? PlayTTColors.primary : "transparent",
          overflow: "hidden",
        },
        thumbInner: {
          borderRadius: selected ? THUMB_RADIUS - 2 : THUMB_RADIUS,
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
          minWidth: 0,
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
            aspectRatio={THUMB_ASPECT}
            style={styles.thumbInner}
            posterUri={posterUri}
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
