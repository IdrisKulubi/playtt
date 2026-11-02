import { type Href, router } from "expo-router"
import { useState } from "react"
import { StyleSheet, View } from "react-native"

import { CoachTrainingDetailSheet } from "@/components/coach/coach-training-detail-sheet"
import { Button } from "@/components/kit/button"
import { ListRow } from "@/components/kit/list-row"
import { ListSection } from "@/components/kit/list-section"
import { AppText } from "@/components/ui/app-text"
import { PlayTTSpacing } from "@/constants/playtt-tokens"
import type { CoachStatus, CoachTrainingItem } from "@/lib/coach-types"

type CoachTrainingPanelProps = {
  items: CoachTrainingItem[]
  status: CoachStatus
  onViewInsights?: () => void
}

const PROGRESS_HREF = "/(app)/(tabs)/activity" as Href

/** Drills as a list: done ones say "Done" with a tick, not just a strike-through. */
export function CoachTrainingPanel({ items, status, onViewInsights }: CoachTrainingPanelProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = items.find((item) => item.id === selectedId) ?? null

  if (!status.isActive) {
    return (
      <AppText variant="body" color="secondaryLabel">
        Start Coach to get drills picked for your game.
      </AppText>
    )
  }

  if (items.length === 0) {
    return (
      <View style={styles.stack}>
        <AppText variant="body" color="secondaryLabel">
          Drills appear after Coach&apos;s first note on your game.
        </AppText>
        <Button
          label="See Coach's notes"
          variant="secondary"
          onPress={onViewInsights ?? (() => router.push(PROGRESS_HREF))}
        />
      </View>
    )
  }

  return (
    <View style={styles.stack}>
      <ListSection header="Your drills">
        {items.map((item) => {
          const length = item.durationMinutes ? `${item.durationMinutes} min` : "Practice drill"
          return (
            <ListRow
              key={item.id}
              icon={item.completedAt ? "checkmark" : "figure.table.tennis"}
              tone={item.completedAt ? "success" : "accent"}
              title={item.title}
              subtitle={item.completedAt ? `${length} · Done` : length}
              accessibilityHint="Opens the drill"
              onPress={() => setSelectedId(item.id)}
            />
          )
        })}
      </ListSection>

      <CoachTrainingDetailSheet item={selected} visible={selected !== null} onClose={() => setSelectedId(null)} />
    </View>
  )
}

const styles = StyleSheet.create({
  stack: { gap: PlayTTSpacing.sm },
})
