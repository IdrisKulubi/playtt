import { useEffect, useRef } from "react"
import { ScrollView, StyleSheet, View } from "react-native"
import Animated, {
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
} from "react-native-reanimated"

import { PressableScale } from "@/components/kit/pressable-scale"
import { AppText } from "@/components/ui/app-text"
import { IconSymbol } from "@/components/ui/icon-symbol"
import { spring } from "@/constants/motion"
import { PlayTTSpacing } from "@/constants/playtt-tokens"
import { useAppTheme } from "@/hooks/use-app-theme"
import type { ActivityStats, StatsBucket, StatsPeriod } from "@/lib/activity-stats-api"
import { METRICS, metricValue, timeLabel, money, type Metric } from "@/lib/stats-dates"

const COLUMN_WIDTH = 44
const BAR_AREA = 140
const GRID_LINES = [0, 1, 2] as const

type BarColumnProps = {
  bucket: StatsBucket
  value: number
  max: number
  index: number
  selected: boolean
  metric: Metric
  onSelect: (index: number) => void
}

function BarColumn({ bucket, value, max, index, selected, metric, onSelect }: BarColumnProps) {
  const { colors } = useAppTheme()
  const reducedMotion = useReducedMotion()
  const grow = useSharedValue(reducedMotion ? 1 : 0)
  const chosen = useSharedValue(selected ? 1 : 0)

  useEffect(() => {
    if (reducedMotion) return
    // Bars rise in from the left, a few milliseconds apart.
    grow.set(withDelay(Math.min(index * 16, 480), withSpring(1, spring("default"))))
  }, [grow, index, reducedMotion])

  useEffect(() => {
    chosen.set(withSpring(selected ? 1 : 0, spring("snappy")))
  }, [chosen, selected])

  const barStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(chosen.get(), [0, 1], [colors.fill, colors.accent]),
    transform: [{ scaleY: grow.get() }, { scaleX: interpolate(chosen.get(), [0, 1], [1, 1.12]) }],
  }))

  const height = value ? Math.max(6, (value / max) * BAR_AREA) : 3

  return (
    <PressableScale
      onPress={() => onSelect(index)}
      haptic="selection"
      accessibilityLabel={`${bucket.label}: ${metricValue(metric, value)}. Show details`}
      accessibilityState={{ selected }}
      style={styles.column}
    >
      <View style={styles.barSlot}>
        <Animated.View style={[styles.bar, { height }, barStyle, !value && { backgroundColor: colors.separator }]} />
      </View>
      <AppText variant="footnote" weight={selected ? "700" : "500"} color={selected ? "label" : "secondaryLabel"} maxFontSizeMultiplier={1.3}>
        {bucket.label}
      </AppText>
    </PressableScale>
  )
}

type StatsChartProps = {
  data: ActivityStats
  period: StatsPeriod
  metric: Metric
  onMetric: (metric: Metric) => void
  selected: number | null
  onSelect: (index: number) => void
  /** "3 November" or "Jan 2026": what the selected bar stands for. */
  detailTitle: string
  comparison: string
  onDetails: () => void
}

/**
 * Metric pills, a bar chart on dotted gridlines, and a summary of the bar
 * you've chosen. Bars rise in when the period changes and the chosen bar
 * springs to the accent colour.
 */
export function StatsChart({ data, period, metric, onMetric, selected, onSelect, detailTitle, comparison, onDetails }: StatsChartProps) {
  const { colors } = useAppTheme()
  const scrollRef = useRef<{ scrollTo: (options: { x: number; y?: number; animated?: boolean }) => void } | null>(null)
  const max = Math.max(...data.buckets.map((bucket) => bucket[metric]), 1)
  const bucket = selected !== null ? data.buckets[selected] : null
  const startIndex = selected === null ? 0 : Math.max(0, Math.min(selected - 3, data.buckets.length - 1))
  const unit = period === "year" ? "month" : period === "month" ? "day" : "time"

  return (
    <View style={styles.root}>
      <View style={styles.pills} accessibilityRole="tablist">
        {METRICS.map((item) => {
          const active = metric === item.key
          return (
            <PressableScale
              key={item.key}
              onPress={() => onMetric(item.key)}
              haptic="selection"
              accessibilityRole="tab"
              accessibilityLabel={`${item.label}: ${metricValue(item.key, data.totals[item.key])}`}
              accessibilityState={{ selected: active }}
              style={[styles.pill, { backgroundColor: active ? colors.accent : colors.surface }]}
            >
              <AppText variant="footnote" weight="600" color={active ? "onAccent" : "secondaryLabel"} maxFontSizeMultiplier={1.3}>
                {item.label}
              </AppText>
              <AppText variant="headline" tabular color={active ? "onAccent" : "label"} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} maxFontSizeMultiplier={1.3}>
                {metricValue(item.key, data.totals[item.key])}
              </AppText>
            </PressableScale>
          )
        })}
      </View>

      <AppText variant="subheadline" weight="600">
        {comparison}
      </AppText>

      <View style={styles.chart}>
        <AppText variant="footnote" color="secondaryLabel">
          {metricValue(metric, data.buckets.some((b) => b[metric]) ? max : 0)}
          {metric === "minutes" ? " booked" : ""}
        </AppText>
        <View style={styles.plot}>
          <View pointerEvents="none" style={styles.grid}>
            {GRID_LINES.map((line) => (
              <View key={line} style={[styles.gridLine, { borderColor: colors.separator }]} />
            ))}
          </View>
          <ScrollView
            // A new dataset starts scrolled to the chosen bar.
            key={`${period}-${data.date}-${metric}`}
            ref={scrollRef as never}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.columns}
            onContentSizeChange={() => scrollRef.current?.scrollTo({ x: startIndex * COLUMN_WIDTH, y: 0, animated: false })}
          >
            {data.buckets.map((item, index) => (
              <BarColumn
                key={`${item.date}-${index}`}
                bucket={item}
                value={item[metric]}
                max={max}
                index={index}
                selected={index === selected}
                metric={metric}
                onSelect={onSelect}
              />
            ))}
          </ScrollView>
        </View>
      </View>

      <AppText variant="footnote" color="secondaryLabel">
        Swipe the chart. Tap a {unit} to explore.
      </AppText>

      {bucket ? (
        <View style={[styles.summary, { borderTopColor: colors.separator }]}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryText}>
              <AppText variant="subheadline" color="secondaryLabel">
                {detailTitle}
              </AppText>
              <AppText variant="title1" tabular>
                {metricValue(metric, bucket[metric])}
              </AppText>
            </View>
            <PressableScale
              onPress={onDetails}
              accessibilityLabel={`View sessions for ${detailTitle}`}
              style={[styles.detailsButton, { backgroundColor: colors.surface }]}
            >
              <AppText variant="callout" weight="600" color="accentText">
                Details
              </AppText>
              <IconSymbol name="chevron.right" size={14} color={colors.accentText} />
            </PressableScale>
          </View>
          <AppText variant="subheadline" color="secondaryLabel">
            {bucket.sessions} {bucket.sessions === 1 ? "session" : "sessions"} · {timeLabel(bucket.minutes)} booked · {money(bucket.spendKes)} paid
          </AppText>
        </View>
      ) : null}

      {!data.totals.bookings ? (
        <View style={styles.empty}>
          <IconSymbol name="calendar" size={28} color={colors.secondaryLabel} />
          <AppText variant="headline">Room for your next session</AppText>
          <AppText variant="subheadline" color="secondaryLabel" style={styles.centered}>
            No bookings in this {period}. Try another period, or book a table to start your story.
          </AppText>
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  root: { gap: PlayTTSpacing.md },
  pills: { flexDirection: "row", gap: PlayTTSpacing.xs },
  pill: {
    flex: 1,
    minHeight: 64,
    borderRadius: 16,
    borderCurve: "continuous",
    paddingHorizontal: PlayTTSpacing.sm,
    paddingVertical: PlayTTSpacing.xs,
    justifyContent: "center",
    gap: 2,
  },
  chart: { gap: PlayTTSpacing.xs },
  plot: { height: BAR_AREA + 36 },
  grid: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, justifyContent: "space-between", paddingBottom: 24 },
  gridLine: { borderTopWidth: 1, borderStyle: "dotted" },
  columns: { paddingRight: PlayTTSpacing.md },
  column: { width: COLUMN_WIDTH, height: BAR_AREA + 36, alignItems: "center", justifyContent: "flex-end", gap: 6 },
  barSlot: { flex: 1, justifyContent: "flex-end" },
  bar: { width: 20, borderTopLeftRadius: 6, borderTopRightRadius: 6, transformOrigin: "bottom" },
  summary: { gap: PlayTTSpacing.xs, paddingTop: PlayTTSpacing.md, borderTopWidth: StyleSheet.hairlineWidth },
  summaryRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: PlayTTSpacing.sm },
  summaryText: { flex: 1 },
  detailsButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    minHeight: 44,
    paddingHorizontal: PlayTTSpacing.md,
    borderRadius: 22,
  },
  empty: { alignItems: "center", gap: PlayTTSpacing.xs, paddingVertical: PlayTTSpacing.lg },
  centered: { textAlign: "center" },
})
