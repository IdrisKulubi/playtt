import { useEffect, useMemo, useState } from "react"
import { StyleSheet, Text, View } from "react-native"

import { BottomSheet } from "@/components/ui/bottom-sheet"
import { PreviewBadge } from "@/components/ui/preview-badge"
import {
  PlayTTFontFamilies,
  PlayTTSpacing,
} from "@/constants/playtt-tokens"
import { useProductTheme } from "@/hooks/use-product-theme"
import { fetchCoachInsightById } from "@/lib/coach-api"
import type { CoachInsight, CoachTrainingItem } from "@/lib/coach-types"

type CoachInsightDetailSheetProps = {
  insight: CoachInsight | null
  visible: boolean
  onClose: () => void
}

export function CoachInsightDetailSheet({
  insight,
  visible,
  onClose,
}: CoachInsightDetailSheetProps) {
  const theme = useProductTheme()
  const [training, setTraining] = useState<CoachTrainingItem[]>([])

  useEffect(() => {
    if (!insight || !visible) {
      setTraining([])
      return
    }

    void fetchCoachInsightById(insight.id).then((result) => {
      setTraining(result?.training ?? [])
    })
  }, [insight, visible])

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: {
          gap: PlayTTSpacing.md,
        },
        summary: {
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
        label: {
          fontSize: 13,
          fontFamily: PlayTTFontFamilies.semiBold,
          color: theme.muted,
          textTransform: "uppercase",
          letterSpacing: 0.4,
        },
        drill: {
          fontSize: 14,
          fontFamily: PlayTTFontFamilies.medium,
          color: theme.foreground,
        },
      }),
    [theme],
  )

  if (!insight) {
    return null
  }

  const recordedLabel = new Date(insight.createdAt).toLocaleString("en-KE", {
    dateStyle: "medium",
    timeStyle: "short",
  })

  return (
    <BottomSheet
      visible={visible}
      title={insight.replayTitle}
      onClose={onClose}
    >
      <View style={styles.root}>
        <Text style={styles.meta}>
          {insight.focusAreas.join(" · ")} · {recordedLabel}
        </Text>
        <Text style={styles.summary}>{insight.summary}</Text>
        <PreviewBadge />
        {training.length > 0 ? (
          <View style={{ gap: PlayTTSpacing.sm }}>
            <Text style={styles.label}>Suggested drills</Text>
            {training.map((item) => (
              <Text key={item.id} style={styles.drill}>
                {item.title}
              </Text>
            ))}
          </View>
        ) : null}
      </View>
    </BottomSheet>
  )
}
