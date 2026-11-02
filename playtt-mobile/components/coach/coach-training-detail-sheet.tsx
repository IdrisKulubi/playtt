import { useState } from "react"
import { StyleSheet, View } from "react-native"

import { AppText } from "@/components/ui/app-text"
import { BottomSheet } from "@/components/ui/bottom-sheet"
import { IconSymbol } from "@/components/ui/icon-symbol"
import { PreviewBadge } from "@/components/ui/preview-badge"
import { PlayTTSpacing } from "@/constants/playtt-tokens"
import { useAppTheme } from "@/hooks/use-app-theme"
import type { CoachTrainingItem } from "@/lib/coach-types"

type CoachTrainingDetailSheetProps = {
  item: CoachTrainingItem | null
  visible: boolean
  onClose: () => void
}

/** One drill: how long it takes and what to do. */
export function CoachTrainingDetailSheet({ item, visible, onClose }: CoachTrainingDetailSheetProps) {
  const { colors } = useAppTheme()
  // Keep showing the last drill while the sheet animates closed.
  const [shown, setShown] = useState(item)
  if (item && item !== shown) setShown(item)

  return (
    <BottomSheet visible={visible} title={shown?.title ?? "Drill"} onClose={onClose} scrollable>
      {shown ? (
        <View style={styles.root}>
          {shown.durationMinutes ? (
            <AppText variant="headline" color="secondaryLabel">
              {shown.durationMinutes} minutes
            </AppText>
          ) : null}
          <AppText variant="body">{shown.description}</AppText>
          <PreviewBadge />
          {shown.completedAt ? (
            <View style={styles.done}>
              <IconSymbol name="checkmark.circle.fill" size={20} color={colors.success} />
              <AppText variant="callout" weight="600" color="success">
                You&apos;ve done this drill
              </AppText>
            </View>
          ) : null}
        </View>
      ) : null}
    </BottomSheet>
  )
}

const styles = StyleSheet.create({
  root: { gap: PlayTTSpacing.md },
  done: { flexDirection: "row", alignItems: "center", gap: PlayTTSpacing.xs },
})
