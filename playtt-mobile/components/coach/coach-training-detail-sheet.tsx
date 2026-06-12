import { useMemo } from "react"
import { StyleSheet, Text, View } from "react-native"

import { BottomSheet } from "@/components/ui/bottom-sheet"
import { PreviewBadge } from "@/components/ui/preview-badge"
import {
  PlayTTFontFamilies,
  PlayTTSpacing,
} from "@/constants/playtt-tokens"
import { useProductTheme } from "@/hooks/use-product-theme"
import type { CoachTrainingItem } from "@/lib/coach-types"

type CoachTrainingDetailSheetProps = {
  item: CoachTrainingItem | null
  visible: boolean
  onClose: () => void
}

export function CoachTrainingDetailSheet({
  item,
  visible,
  onClose,
}: CoachTrainingDetailSheetProps) {
  const theme = useProductTheme()

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: {
          gap: PlayTTSpacing.md,
        },
        description: {
          fontSize: 15,
          fontFamily: PlayTTFontFamilies.regular,
          color: theme.foreground,
          lineHeight: 22,
        },
        meta: {
          fontSize: 13,
          fontFamily: PlayTTFontFamilies.regular,
          color: theme.muted,
        },
      }),
    [theme],
  )

  if (!item) {
    return null
  }

  return (
    <BottomSheet visible={visible} title={item.title} onClose={onClose}>
      <View style={styles.root}>
        {item.durationMinutes ? (
          <Text style={styles.meta}>{item.durationMinutes} minutes</Text>
        ) : null}
        <Text style={styles.description}>{item.description}</Text>
        <PreviewBadge />
        {item.completedAt ? (
          <Text style={styles.meta}>Completed</Text>
        ) : null}
      </View>
    </BottomSheet>
  )
}
