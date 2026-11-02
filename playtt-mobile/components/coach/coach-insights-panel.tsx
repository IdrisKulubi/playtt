import { type Href, router } from "expo-router"
import { useState } from "react"
import { StyleSheet, View } from "react-native"

import { CoachInsightDetailSheet } from "@/components/coach/coach-insight-detail-sheet"
import { Button } from "@/components/kit/button"
import { Card } from "@/components/kit/card"
import { AppText } from "@/components/ui/app-text"
import { PlayTTSpacing } from "@/constants/playtt-tokens"
import type { CoachInsight, CoachStatus } from "@/lib/coach-types"

type CoachInsightsPanelProps = {
  insights: CoachInsight[]
  status: CoachStatus
}

const PROGRESS_HREF = "/(app)/(tabs)/activity" as Href

/** What Coach noticed in each replay, as cards you can open. */
export function CoachInsightsPanel({ insights, status }: CoachInsightsPanelProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = insights.find((item) => item.id === selectedId) ?? null

  if (!status.isActive) {
    return (
      <AppText variant="body" color="secondaryLabel">
        Start Coach to see what it notices in your replays.
      </AppText>
    )
  }

  if (insights.length === 0) {
    return (
      <View style={styles.stack}>
        <AppText variant="body" color="secondaryLabel">
          Play a game and save a replay. Coach&apos;s first notes will appear here.
        </AppText>
        <Button label="See my replays" variant="secondary" onPress={() => router.push(PROGRESS_HREF)} />
      </View>
    )
  }

  return (
    <View style={styles.stack}>
      {insights.map((insight) => (
        <Card
          key={insight.id}
          onPress={() => setSelectedId(insight.id)}
          accessibilityLabel={`${insight.focusAreas.join(", ")}. From ${insight.replayTitle}`}
          accessibilityHint="Opens the full note"
        >
          <View style={styles.card}>
            <AppText variant="footnote" color="secondaryLabel">
              {insight.replayTitle}
            </AppText>
            <AppText variant="headline">{insight.focusAreas.join(" · ")}</AppText>
            <AppText variant="callout" color="secondaryLabel" numberOfLines={3}>
              {insight.summary}
            </AppText>
          </View>
        </Card>
      ))}

      <CoachInsightDetailSheet insight={selected} visible={selected !== null} onClose={() => setSelectedId(null)} />
    </View>
  )
}

const styles = StyleSheet.create({
  stack: { gap: PlayTTSpacing.sm },
  card: { gap: 4 },
})
