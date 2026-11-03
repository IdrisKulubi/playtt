import { type Href, router } from "expo-router"
import { useEffect, useState } from "react"
import { StyleSheet, View } from "react-native"

import { ActivityRing } from "@/components/activity/activity-ring"
import { GoalSheet } from "@/components/activity/goal-sheet"
import { MiniBars } from "@/components/activity/mini-bars"
import { WeekStrip } from "@/components/activity/week-strip"
import { Button } from "@/components/kit/button"
import { Card } from "@/components/kit/card"
import { PressableScale } from "@/components/kit/pressable-scale"
import { AppText } from "@/components/ui/app-text"
import { IconSymbol } from "@/components/ui/icon-symbol"
import { PreviewBadge } from "@/components/ui/preview-badge"
import { Skeleton } from "@/components/ui/skeleton"
import { KitLayout } from "@/constants/kit-layout"
import { PlayTTSpacing } from "@/constants/playtt-tokens"
import { useAppTheme } from "@/hooks/use-app-theme"
import { useProgressSummary } from "@/hooks/use-progress-summary"
import { fetchCommunityMe } from "@/lib/community-api"
import { MOCK_SAMPLE_LABEL, USE_LIVE_PLAYER_STATS } from "@/lib/mock/mock-config"
import { parseDate, timeLabel } from "@/lib/stats-dates"
import { useWeeklyGoal } from "@/lib/weekly-goal"

const STATS_HREF = "/(app)/progress/stats" as Href

function openStats() {
  router.push(STATS_HREF)
}

function weekRange(weekStart: string) {
  const start = parseDate(weekStart)
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6)
  const day = (date: Date, withMonth: boolean) =>
    date.toLocaleDateString("en-KE", withMonth ? { day: "numeric", month: "short" } : { day: "numeric" })
  return start.getMonth() === end.getMonth()
    ? `${day(start, false)} – ${day(end, true)}`
    : `${day(start, true)} – ${day(end, true)}`
}

/** The round arrow button in a tile's corner. The whole tile opens too. */
function ChevronBadge() {
  const { colors } = useAppTheme()
  return (
    <View style={[styles.chevron, { backgroundColor: colors.fill }]}>
      <IconSymbol name="chevron.right" size={14} color={colors.secondaryLabel} />
    </View>
  )
}

type TileProps = {
  title: string
  caption: string
  value: string
  unit?: string
  tone: "accentText" | "success" | "warning"
  accessibilityLabel: string
  children?: React.ReactNode
}

/** A summary tile: title, a big coloured number, and a little chart. */
function SummaryTile({ title, caption, value, unit, tone, accessibilityLabel, children }: TileProps) {
  return (
    <Card onPress={openStats} accessibilityLabel={accessibilityLabel} accessibilityHint="Opens detailed stats" style={styles.tile}>
      <View style={styles.tileBody}>
        <View style={styles.tileHeader}>
          <AppText variant="headline" numberOfLines={1} style={styles.flex}>
            {title}
          </AppText>
          <ChevronBadge />
        </View>
        <AppText variant="subheadline" color="secondaryLabel">
          {caption}
        </AppText>
        <View style={styles.tileValue}>
          <AppText variant="largeTitle" tabular color={tone} maxFontSizeMultiplier={1.3}>
            {value}
          </AppText>
          {unit ? (
            <AppText variant="subheadline" weight="700" color={tone} maxFontSizeMultiplier={1.3}>
              {unit}
            </AppText>
          ) : null}
        </View>
        {children}
      </View>
    </Card>
  )
}

function SummarySkeleton() {
  return (
    <View style={styles.stack} accessibilityRole="progressbar" accessibilityLabel="Loading">
      <Skeleton height={300} borderRadius={KitLayout.cardRadius} />
      <View style={styles.tiles}>
        <Skeleton height={190} borderRadius={KitLayout.cardRadius} style={styles.tileSlot} />
        <Skeleton height={190} borderRadius={KitLayout.cardRadius} style={styles.tileSlot} />
      </View>
    </View>
  )
}

/**
 * The Progress summary, in the spirit of Apple's Fitness: one big ring for
 * this week's table time, the week as seven small rings, then tiles for the
 * month with their own tiny charts.
 */
export function ProgressSummary() {
  const { colors } = useAppTheme()
  const goal = useWeeklyGoal()
  const summary = useProgressSummary()
  const [goalOpen, setGoalOpen] = useState(false)
  // From the player card: only scored matches count, so this can be empty.
  const [winRate, setWinRate] = useState<number | null>(null)

  useEffect(() => {
    let mounted = true
    fetchCommunityMe()
      .then((me) => {
        const { matches, winRate: rate } = me.stats
        if (mounted && matches && matches > 0 && rate !== null) setWinRate(rate)
      })
      .catch(() => undefined)
    return () => {
      mounted = false
    }
  }, [])

  if (summary.failed) {
    return (
      <Card>
        <View style={styles.stack}>
          <AppText variant="body" color="secondaryLabel">
            Your numbers couldn&apos;t load. Check your connection, then try again.
          </AppText>
          <Button label="Try again" variant="secondary" onPress={summary.reload} />
        </View>
      </Card>
    )
  }

  if (!summary.month || !summary.week) return <SummarySkeleton />

  const { month, week, weekMinutes = 0, weekSessions = 0, weekStart = "" } = summary
  const reached = weekMinutes >= goal
  const remaining = timeLabel(Math.max(goal - weekMinutes, 0))
  const hours = Math.round((month.totals.minutes / 60) * 10) / 10
  const dayMinutes = month.buckets.map((bucket) => bucket.minutes)
  const daySessions = month.buckets.map((bucket) => bucket.sessions)

  return (
    <View style={styles.stack}>
      <Card>
        <View style={styles.tileBody}>
          <View style={styles.tileHeader}>
            <View style={styles.flex}>
              <AppText variant="title3" accessibilityRole="header">
                Table time
              </AppText>
              <AppText variant="subheadline" color="secondaryLabel">
                This week · {weekRange(weekStart)}
              </AppText>
            </View>
            {!USE_LIVE_PLAYER_STATS ? <PreviewBadge label={MOCK_SAMPLE_LABEL} /> : null}
            <PressableScale onPress={openStats} accessibilityLabel="Open detailed stats" hitSlop={8}>
              <ChevronBadge />
            </PressableScale>
          </View>

          <View
            style={styles.heroRow}
            accessible
            accessibilityLabel={`${timeLabel(weekMinutes)} this week, goal ${timeLabel(goal)}. ${
              reached ? "Goal reached." : `${remaining} to go.`
            }`}
          >
            <ActivityRing
              size={132}
              lineWidth={24}
              progress={weekMinutes / goal}
              color={colors.accent}
              overlapColor={colors.accentText}
              capIconColor={colors.onAccent}
            />
            <View style={styles.heroText}>
              <AppText variant="subheadline" color="secondaryLabel">
                Played
              </AppText>
              <View style={styles.tileValue}>
                <AppText variant="title1" tabular color="accentText" maxFontSizeMultiplier={1.3}>
                  {timeLabel(weekMinutes)}
                </AppText>
                <AppText variant="subheadline" weight="700" color="accentText" maxFontSizeMultiplier={1.3}>
                  / {timeLabel(goal)}
                </AppText>
              </View>
              <AppText variant="subheadline" color={reached ? "success" : "secondaryLabel"} weight={reached ? "600" : undefined}>
                {reached
                  ? "Goal reached. Great week!"
                  : weekSessions
                    ? `${remaining} to go`
                    : "No games yet this week"}
              </AppText>
            </View>
          </View>

          <WeekStrip days={week} />

          <PressableScale
            onPress={() => setGoalOpen(true)}
            accessibilityLabel="Change your weekly goal"
            style={styles.goalButton}
          >
            <IconSymbol name="slider.horizontal.3" size={18} color={colors.accentText} />
            <AppText variant="callout" weight="600" color="accentText">
              Change goal
            </AppText>
          </PressableScale>
        </View>
      </Card>

      <View style={styles.tiles}>
        <View style={styles.tileSlot}>
          <SummaryTile
            title="Hours"
            caption={month.label}
            value={String(hours)}
            unit="HRS"
            tone="accentText"
            accessibilityLabel={`Hours at the table in ${month.label}: ${hours}`}
          >
            <MiniBars values={dayMinutes} color={colors.accent} />
          </SummaryTile>
        </View>
        <View style={styles.tileSlot}>
          <SummaryTile
            title="Games"
            caption={month.label}
            value={String(month.totals.sessions)}
            unit={month.totals.sessions === 1 ? "GAME" : "GAMES"}
            tone="success"
            accessibilityLabel={`Games played in ${month.label}: ${month.totals.sessions}`}
          >
            <MiniBars values={daySessions} color={colors.success} />
          </SummaryTile>
        </View>
      </View>

      {winRate !== null ? (
        <Card onPress={openStats} accessibilityLabel={`Win rate ${Math.round(winRate)} percent`} accessibilityHint="Opens detailed stats">
          <View style={styles.winRow}>
            <ActivityRing
              size={64}
              lineWidth={11}
              progress={winRate / 100}
              color={colors.warning}
              capIconColor={colors.onAccent}
              showCap={false}
              delayMs={150}
            />
            <View style={styles.flex}>
              <AppText variant="headline">Win rate</AppText>
              <View style={styles.tileValue}>
                <AppText variant="title1" tabular color="warning">
                  {Math.round(winRate)}%
                </AppText>
                <AppText variant="subheadline" color="secondaryLabel">
                  of matches won
                </AppText>
              </View>
            </View>
            <ChevronBadge />
          </View>
        </Card>
      ) : null}

      <GoalSheet visible={goalOpen} onClose={() => setGoalOpen(false)} weekMinutes={weekMinutes} />
    </View>
  )
}

const styles = StyleSheet.create({
  stack: { gap: PlayTTSpacing.md },
  flex: { flex: 1 },
  tileBody: { gap: PlayTTSpacing.sm },
  tileHeader: { flexDirection: "row", alignItems: "center", gap: PlayTTSpacing.xs },
  tiles: { flexDirection: "row", gap: PlayTTSpacing.md },
  tileSlot: { flex: 1 },
  tile: { flex: 1, padding: PlayTTSpacing.md },
  tileValue: { flexDirection: "row", alignItems: "baseline", gap: PlayTTSpacing.xs },
  chevron: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  heroRow: { flexDirection: "row", alignItems: "center", gap: PlayTTSpacing.lg, paddingVertical: PlayTTSpacing.xs },
  heroText: { flex: 1, gap: 2 },
  goalButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: PlayTTSpacing.xs,
    minHeight: KitLayout.minTouchTarget,
  },
  winRow: { flexDirection: "row", alignItems: "center", gap: PlayTTSpacing.md },
})
