import { useMemo } from "react"
import { Alert, Pressable, StyleSheet, Text, View } from "react-native"

import { BottomSheet } from "@/components/ui/bottom-sheet"
import { IconSymbol } from "@/components/ui/icon-symbol"
import {
  PlayTTColors,
  PlayTTFontFamilies,
  PlayTTSpacing,
} from "@/constants/playtt-tokens"
import { useProductTheme } from "@/hooks/use-product-theme"
import type { ReplaySummary } from "@/lib/replay-types"

type ReplayClipActionsSheetProps = {
  replay: ReplaySummary | null
  visible: boolean
  onClose: () => void
  onToggleFavorite: (replay: ReplaySummary) => void
  onArchive: (replay: ReplaySummary) => void
  onDelete: (replay: ReplaySummary) => void
}

type ActionRowProps = {
  label: string
  icon: "star.fill" | "arrow.down.circle.fill" | "xmark.circle.fill"
  destructive?: boolean
  onPress: () => void
}

function ActionRow({ label, icon, destructive, onPress }: ActionRowProps) {
  const theme = useProductTheme()
  const color = destructive ? PlayTTColors.destructive : theme.foreground

  const styles = useMemo(
    () =>
      StyleSheet.create({
        row: {
          flexDirection: "row",
          alignItems: "center",
          gap: PlayTTSpacing.sm,
          paddingVertical: PlayTTSpacing.md,
          paddingHorizontal: PlayTTSpacing.xs,
        },
        label: {
          fontSize: 16,
          fontFamily: PlayTTFontFamilies.medium,
          color,
        },
        pressed: {
          opacity: 0.85,
        },
      }),
    [color],
  )

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <IconSymbol name={icon} size={22} color={color} />
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  )
}

export function ReplayClipActionsSheet({
  replay,
  visible,
  onClose,
  onToggleFavorite,
  onArchive,
  onDelete,
}: ReplayClipActionsSheetProps) {
  if (!replay) {
    return null
  }

  const favoriteLabel = replay.isFavorite ? "Remove favorite" : "Favorite"

  const handleDelete = () => {
    Alert.alert(
      "Delete clip?",
      "This removes the clip from your library and queues the video for deletion.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            onDelete(replay)
            onClose()
          },
        },
      ],
    )
  }

  return (
    <BottomSheet visible={visible} title={replay.title} onClose={onClose}>
      <View>
        <ActionRow
          label={favoriteLabel}
          icon="star.fill"
          onPress={() => {
            onToggleFavorite(replay)
            onClose()
          }}
        />
        <ActionRow
          label="Archive"
          icon="arrow.down.circle.fill"
          onPress={() => {
            onArchive(replay)
            onClose()
          }}
        />
        <ActionRow
          label="Delete"
          icon="xmark.circle.fill"
          destructive
          onPress={handleDelete}
        />
      </View>
    </BottomSheet>
  )
}
