import { useEffect, useState } from "react"
import { StyleSheet, View } from "react-native"

import { ListRow } from "@/components/kit/list-row"
import { ListSection } from "@/components/kit/list-section"
import { AppText } from "@/components/ui/app-text"
import { BottomSheet } from "@/components/ui/bottom-sheet"
import { PreviewBadge } from "@/components/ui/preview-badge"
import { PlayTTSpacing } from "@/constants/playtt-tokens"
import { fetchCoachInsightById } from "@/lib/coach-api"
import type { CoachInsight, CoachTrainingItem } from "@/lib/coach-types"

type CoachInsightDetailSheetProps = {
  insight: CoachInsight | null
  visible: boolean
  onClose: () => void
}

/** One Coach note in full, with the drills it suggests. */
export function CoachInsightDetailSheet({ insight, visible, onClose }: CoachInsightDetailSheetProps) {
  // Keep showing the last note while the sheet animates closed.
  const [shown, setShown] = useState(insight)
  if (insight && insight !== shown) setShown(insight)

  return (
    <BottomSheet visible={visible} title={shown?.replayTitle ?? "Coach note"} onClose={onClose} scrollable>
      {shown ? <InsightBody key={shown.id} insight={shown} /> : null}
    </BottomSheet>
  )
}

function InsightBody({ insight }: { insight: CoachInsight }) {
  const [training, setTraining] = useState<CoachTrainingItem[]>([])

  useEffect(() => {
    let mounted = true
    void fetchCoachInsightById(insight.id).then((result) => {
      if (mounted) setTraining(result?.training ?? [])
    })
    return () => {
      mounted = false
    }
  }, [insight.id])

  const recordedLabel = new Date(insight.createdAt).toLocaleString("en-KE", {
    dateStyle: "medium",
    timeStyle: "short",
  })

  return (
    <View style={styles.root}>
      <View style={styles.meta}>
        <AppText variant="headline">{insight.focusAreas.join(" · ")}</AppText>
        <AppText variant="footnote" color="secondaryLabel">
          {recordedLabel}
        </AppText>
      </View>
      <AppText variant="body">{insight.summary}</AppText>
      <PreviewBadge />
      {training.length > 0 ? (
        <ListSection header="Drills to try">
          {training.map((item) => (
            <ListRow
              key={item.id}
              icon="figure.table.tennis"
              title={item.title}
              subtitle={item.durationMinutes ? `${item.durationMinutes} min` : undefined}
            />
          ))}
        </ListSection>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  root: { gap: PlayTTSpacing.md },
  meta: { gap: 2 },
})
