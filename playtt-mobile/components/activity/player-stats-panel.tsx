import { useEffect, useState } from "react"
import { StyleSheet, View } from "react-native"

import { GoalSheet } from "@/components/activity/goal-sheet"
import { StatsChart } from "@/components/activity/stats-chart"
import { StatsHero } from "@/components/activity/stats-hero"
import { StatsDetailSheet, StatsPickerSheet } from "@/components/activity/stats-sheets"
import { StatsShareSheet } from "@/components/activity/stats-share-sheet"
import { WeekStrip } from "@/components/activity/week-strip"
import { Button } from "@/components/kit/button"
import { ListRow } from "@/components/kit/list-row"
import { ListSection } from "@/components/kit/list-section"
import { PressableScale } from "@/components/kit/pressable-scale"
import { SegmentedControl } from "@/components/kit/segmented-control"
import { AppText } from "@/components/ui/app-text"
import { IconSymbol } from "@/components/ui/icon-symbol"
import { PreviewBadge } from "@/components/ui/preview-badge"
import { Skeleton, SkeletonGroup } from "@/components/ui/skeleton/skeleton"
import { PlayTTSpacing } from "@/constants/playtt-tokens"
import { buildWeek, loadMonth, monthsOfWeek, type WeekDay } from "@/hooks/use-progress-summary"
import { useAppTheme } from "@/hooks/use-app-theme"
import { fetchActivityStats, type ActivityStats, type StatsPeriod, type StatsSession } from "@/lib/activity-stats-api"
import { sampleActivityStats } from "@/lib/mock/mock-activity-stats"
import { USE_LIVE_PLAYER_STATS } from "@/lib/mock/mock-config"
import {
  daysInMonth,
  metricValue,
  money,
  parseDate,
  shiftStatsDate,
  startOfWeek,
  timeLabel,
  todayKey,
  type Metric,
} from "@/lib/stats-dates"
import { useWeeklyGoal } from "@/lib/weekly-goal"

export { shiftStatsDate } from "@/lib/stats-dates"

const nairobiDate = (iso: string) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Nairobi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(iso))
  return `${parts.find((p) => p.type === "year")?.value}-${parts.find((p) => p.type === "month")?.value}-${parts.find((p) => p.type === "day")?.value}`
}

function sessionHour(s: StatsSession) {
  return Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Nairobi", hour: "2-digit", hourCycle: "h23" }).format(new Date(s.startTime))
  )
}

/** All the state and screens behind detailed stats; the route just lays them out. */
export function usePlayerStatsApi() {
  const { colors } = useAppTheme()
  const weeklyGoal = useWeeklyGoal()
  const [period, setPeriod] = useState<StatsPeriod>("month"),
    [date, setDate] = useState(todayKey)
  const [metric, setMetric] = useState<Metric>("minutes")
  const [result, setResult] = useState<{ key: string; data?: ActivityStats; error?: boolean } | null>(null),
    [retry, setRetry] = useState(0)
  const requestKey = `${period}-${date}-${retry}`,
    data = result?.key === requestKey ? (result.data ?? null) : null,
    loading = result?.key !== requestKey,
    error = result?.key === requestKey && result.error
  const [selected, setSelected] = useState<number | null>(null),
    [detailOpen, setDetailOpen] = useState(false),
    [shareOpen, setShareOpen] = useState(false),
    [goalOpen, setGoalOpen] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false),
    [pickerYear, setPickerYear] = useState(Number(date.slice(0, 4))),
    [pickerMonth, setPickerMonth] = useState(Number(date.slice(5, 7)) - 1)
  const [week, setWeek] = useState<{ start: string; days: WeekDay[] } | null>(null)
  const current = todayKey()
  const weekStart = startOfWeek(date)

  useEffect(() => {
    let active = true
    const request = USE_LIVE_PLAYER_STATS ? fetchActivityStats(period, date) : Promise.resolve(sampleActivityStats(period, date))
    void request
      .then((stats) => {
        if (!active) return
        setResult({ key: requestKey, data: stats })
        let index = stats.buckets.length - 1
        while (index > 0 && !stats.buckets[index].sessions) index--
        setSelected(index)
      })
      .catch(() => {
        if (active) setResult({ key: requestKey, error: true })
      })
    return () => {
      active = false
    }
  }, [period, date, retry, requestKey])

  // The week row above the day view: needs the whole week's totals.
  useEffect(() => {
    if (period !== "day") return
    let active = true
    void Promise.all(monthsOfWeek(weekStart).map(loadMonth))
      .then((stats) => {
        if (active) setWeek({ start: weekStart, days: buildWeek(weekStart, current, stats) })
      })
      .catch(() => {
        if (active) setWeek(null)
      })
    return () => {
      active = false
    }
  }, [period, weekStart, current])

  const previousDate = shiftStatsDate(date, period, -1),
    canPrevious = previousDate >= "2000-01-01"
  const nextDate = shiftStatsDate(date, period, 1)
  const canNext =
    period === "year"
      ? nextDate.slice(0, 4) <= current.slice(0, 4)
      : period === "month"
        ? nextDate.slice(0, 7) <= current.slice(0, 7)
        : nextDate <= current
  const periodLabel =
    data?.label ??
    parseDate(date).toLocaleDateString(
      "en-KE",
      period === "year"
        ? { year: "numeric" }
        : period === "month"
          ? { month: "long", year: "numeric" }
          : { day: "numeric", month: "long", year: "numeric" }
    )
  const bucket = selected !== null ? data?.buckets[selected] : null
  const detailSessions = data
    ? data.sessions.filter(
        (s) =>
          !bucket ||
          (period === "year"
            ? nairobiDate(s.startTime).slice(0, 7) === bucket.date.slice(0, 7)
            : period === "month"
              ? nairobiDate(s.startTime) === bucket.date.slice(0, 10)
              : sessionHour(s) === selected)
      )
    : []
  const detailTitle = bucket
    ? period === "year"
      ? parseDate(bucket.date).toLocaleDateString("en-KE", { month: "long", year: "numeric" })
      : period === "month"
        ? parseDate(bucket.date).toLocaleDateString("en-KE", { day: "numeric", month: "long" })
        : `${bucket.label} · ${periodLabel}`
    : periodLabel
  const previous = data?.previous.totals[metric] ?? 0,
    difference = data ? data.totals[metric] - previous : 0
  const comparison = !data
    ? ""
    : !previous
      ? data.totals[metric]
        ? `Activity recorded this ${period}; none in ${data.previous.label}`
        : "No activity in either period"
      : !difference
        ? `Same as ${data.previous.label}`
        : `${metricValue(metric, Math.abs(difference))} ${difference > 0 ? "more" : "less"} than ${data.previous.label}`

  // The ring closes at your weekly goal, scaled to the period on screen.
  const goalMinutes =
    period === "day" ? weeklyGoal : period === "month" ? (weeklyGoal * daysInMonth(date)) / 7 : weeklyGoal * 52
  const goalName = period === "day" ? "your weekly goal" : period === "month" ? "your monthly pace" : "your yearly pace"

  function chooseDate(value: string) {
    setDate(value)
    setPickerOpen(false)
  }
  function openPicker() {
    setPickerYear(Number(date.slice(0, 4)))
    setPickerMonth(Number(date.slice(5, 7)) - 1)
    setPickerOpen(true)
  }
  function drillDown() {
    if (bucket) {
      setDetailOpen(false)
      setDate(bucket.date.slice(0, 10))
      setPeriod(period === "year" ? "month" : "day")
    }
  }
  function selectPeriod(next: StatsPeriod) {
    setDate((d) => (next === "year" ? `${d.slice(0, 4)}-01-01` : next === "month" ? `${d.slice(0, 7)}-01` : d))
    setPeriod(next)
  }

  const styles = StyleSheet.create({
    controls: { gap: PlayTTSpacing.md },
    nav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: PlayTTSpacing.xs },
    round: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", backgroundColor: colors.fill },
    disabled: { opacity: 0.3 },
    periodTitle: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, minHeight: 48 },
    content: { gap: PlayTTSpacing.xl },
    error: { gap: PlayTTSpacing.sm, padding: PlayTTSpacing.md, borderRadius: 20, backgroundColor: colors.surface },
    badge: { alignSelf: "flex-start" },
  })

  function renderControls() {
    return (
      <View style={styles.controls}>
        <SegmentedControl
          label="Period"
          value={period}
          options={[
            { value: "year", label: "Year" },
            { value: "month", label: "Month" },
            { value: "day", label: "Day" },
          ]}
          onChange={selectPeriod}
        />
        {period === "day" && week && week.start === weekStart ? (
          <WeekStrip days={week.days} selectedKey={date} onSelect={(key) => key <= current && setDate(key)} />
        ) : null}
        <View style={styles.nav}>
          <PressableScale
            onPress={() => setDate(previousDate)}
            disabled={!canPrevious}
            haptic="selection"
            accessibilityLabel={`Previous ${period}`}
            accessibilityState={{ disabled: !canPrevious }}
            style={[styles.round, !canPrevious && styles.disabled]}
          >
            <IconSymbol name="chevron.left" size={20} color={colors.accentText} />
          </PressableScale>
          <PressableScale
            onPress={openPicker}
            accessibilityLabel={`Choose ${period}, ${periodLabel}`}
            style={styles.periodTitle}
          >
            <AppText variant="title3" numberOfLines={1}>
              {periodLabel}
            </AppText>
            <IconSymbol name="chevron.down" size={16} color={colors.secondaryLabel} />
          </PressableScale>
          <PressableScale
            onPress={() => setDate(nextDate)}
            disabled={!canNext}
            haptic="selection"
            accessibilityLabel={`Next ${period}`}
            accessibilityState={{ disabled: !canNext }}
            style={[styles.round, !canNext && styles.disabled]}
          >
            <IconSymbol name="chevron.right" size={20} color={colors.accentText} />
          </PressableScale>
        </View>
      </View>
    )
  }

  function renderScrollContent() {
    return (
      <View style={styles.content}>
        {loading ? (
          <SkeletonGroup gap="lg">
            <Skeleton width="100%" height={260} borderRadius={20} />
            <Skeleton width="100%" height={230} borderRadius={20} />
            <Skeleton width="100%" height={120} borderRadius={20} />
          </SkeletonGroup>
        ) : error ? (
          <View style={styles.error} accessibilityLiveRegion="polite">
            <AppText variant="title3">Stats couldn’t load</AppText>
            <AppText variant="subheadline" color="secondaryLabel">
              Check your connection and try again.
            </AppText>
            <Button label="Try again" variant="secondary" onPress={() => setRetry((r) => r + 1)} />
          </View>
        ) : data ? (
          <>
            <StatsHero
              minutes={data.totals.minutes}
              goalMinutes={goalMinutes}
              goalName={goalName}
              onChangeGoal={() => setGoalOpen(true)}
            />
            <StatsChart
              data={data}
              period={period}
              metric={metric}
              onMetric={setMetric}
              selected={selected}
              onSelect={setSelected}
              detailTitle={detailTitle}
              comparison={comparison}
              onDetails={() => setDetailOpen(true)}
            />
            <ListSection header="The details" separatorInset={PlayTTSpacing.md}>
              <ListRow title="Average session" accessory={{ kind: "value", value: timeLabel(data.totals.averageMinutes) }} />
              <ListRow title="Average paid per booking" accessory={{ kind: "value", value: money(data.totals.averageSpendKes) }} />
              <ListRow
                title="All bookings"
                accessory={{ kind: "value", value: String(data.totals.bookings) }}
                onPress={() => {
                  setSelected(null)
                  setDetailOpen(true)
                }}
              />
              <ListRow title="Cancelled bookings" accessory={{ kind: "value", value: String(data.totals.cancelledSessions) }} />
            </ListSection>
            <View style={styles.controls}>
              <AppText variant="footnote" color="secondaryLabel">
                Table time is the reserved duration of past sessions, not measured playing time. All dates use Nairobi time.
              </AppText>
              {data.notes.map((note) => (
                <AppText key={note} variant="footnote" color="secondaryLabel">
                  {note}
                </AppText>
              ))}
            </View>
            <Button label="Share your table story" onPress={() => setShareOpen(true)} accessibilityHint="Creates a branded stats image" />
            {!USE_LIVE_PLAYER_STATS ? (
              <View style={styles.badge}>
                <PreviewBadge label="Sample" />
              </View>
            ) : null}
          </>
        ) : (
          <View style={styles.error} accessibilityLiveRegion="polite">
            <AppText variant="title3">Loading your stats</AppText>
            <AppText variant="subheadline" color="secondaryLabel">
              This should only take a moment.
            </AppText>
          </View>
        )}
      </View>
    )
  }

  function renderOverlays() {
    return (
      <>
        {data ? (
          <StatsShareSheet
            visible={shareOpen}
            onClose={() => setShareOpen(false)}
            data={{
              periodLabel: data.label,
              sessions: data.totals.sessions,
              minutes: data.totals.minutes,
              spendingKes: data.totals.spendKes,
              preview: !USE_LIVE_PLAYER_STATS,
              goalMinutes,
              bars: data.buckets.map((b) => b.minutes),
            }}
          />
        ) : null}
        <StatsDetailSheet
          visible={detailOpen}
          title={detailTitle}
          period={period}
          sessions={detailSessions}
          sample={!USE_LIVE_PLAYER_STATS}
          onDrillDown={bucket && period !== "day" ? drillDown : undefined}
          notes={metric === "spendKes" ? data?.notes : undefined}
          onClose={() => setDetailOpen(false)}
        />
        <StatsPickerSheet
          visible={pickerOpen}
          period={period}
          date={date}
          today={current}
          year={pickerYear}
          month={pickerMonth}
          onYear={setPickerYear}
          onMonth={setPickerMonth}
          onChoose={chooseDate}
          onClose={() => setPickerOpen(false)}
        />
        <GoalSheet visible={goalOpen} onClose={() => setGoalOpen(false)} />
      </>
    )
  }

  return {
    ready: Boolean(data),
    openPicker,
    openShare: () => setShareOpen(true),
    renderControls,
    renderScrollContent,
    renderOverlays,
  }
}

export function PlayerStatsPanel() {
  const stats = usePlayerStatsApi()

  return (
    <>
      <View style={{ gap: PlayTTSpacing.lg }}>
        {stats.renderControls()}
        {stats.renderScrollContent()}
      </View>
      {stats.renderOverlays()}
    </>
  )
}
