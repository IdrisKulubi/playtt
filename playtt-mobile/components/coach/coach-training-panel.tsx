import { router } from "expo-router"
import { useMemo, useState } from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"

import { Button } from "@/components/ui/button"

import { CoachTrainingDetailSheet } from "@/components/coach/coach-training-detail-sheet"
import { IconSymbol } from "@/components/ui/icon-symbol"
import {
  PlayTTFontFamilies,
  PlayTTSpacing,
} from "@/constants/playtt-tokens"
import { useProductTheme } from "@/hooks/use-product-theme"
import type { CoachStatus, CoachTrainingItem } from "@/lib/coach-types"

type CoachTrainingPanelProps = {
  items: CoachTrainingItem[]
  status: CoachStatus
  onViewInsights?: () => void
}

export function CoachTrainingPanel({
  items,
  status,
  onViewInsights,
}: CoachTrainingPanelProps) {
  const theme = useProductTheme()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = items.find((item) => item.id === selectedId) ?? null

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: {
          gap: 0,
        },
        empty: {
          gap: PlayTTSpacing.sm,
        },
        emptyText: {
          fontSize: 15,
          fontFamily: PlayTTFontFamilies.regular,
          color: theme.muted,
          lineHeight: 22,
        },
        row: {
          paddingVertical: PlayTTSpacing.md,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: theme.border,
        },
        pressed: {
          opacity: 0.7,
        },
        rowInner: {
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
        done: {
          textDecorationLine: "line-through",
          opacity: 0.6,
        },
      }),
    [theme],
  )

  if (!status.isActive) {
    return (
      <Text style={styles.emptyText}>
        Subscribe to Coach to get personalized drills from your sessions.
      </Text>
    )
  }

  if (items.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>
          Training suggestions will appear after your first coach insight.
        </Text>
        <Button
          label="View insights"
          variant="outline"
          surface="product"
          productTheme={theme}
          onPress={onViewInsights ?? (() => router.push("/(app)/(tabs)/activity"))}
        />
      </View>
    )
  }

  return (
    <View style={styles.root}>
      {items.map((item, index) => (
        <Pressable
          key={item.id}
          onPress={() => setSelectedId(item.id)}
          style={({ pressed }) => [styles.row, pressed && styles.pressed]}
        >
          <View style={styles.rowInner}>
            <View style={styles.copy}>
              <Text
                style={[styles.title, item.completedAt ? styles.done : null]}
              >
                {item.title}
              </Text>
              <Text style={styles.meta}>
                {item.durationMinutes
                  ? `${item.durationMinutes} min`
                  : "Practice drill"}
                {item.completedAt ? " · Done" : ""}
              </Text>
            </View>
            <IconSymbol name="chevron.right" size={18} color={theme.muted} />
          </View>
        </Pressable>
      ))}

      <CoachTrainingDetailSheet
        item={selected}
        visible={selected !== null}
        onClose={() => setSelectedId(null)}
      />
    </View>
  )
}
