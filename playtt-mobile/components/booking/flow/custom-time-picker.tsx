import { StyleSheet, View } from "react-native"

import { Button } from "@/components/kit/button"
import { Card } from "@/components/kit/card"
import { PressableScale } from "@/components/kit/pressable-scale"
import { AppText } from "@/components/ui/app-text"
import { IconSymbol } from "@/components/ui/icon-symbol"
import { PlayTTSpacing } from "@/constants/playtt-tokens"
import { useAppTheme } from "@/hooks/use-app-theme"
import type { BookingPlan, BookingSuggestion } from "@/lib/booking-types"
import { describeSuggestion, formatDurationLabel, formatKes } from "@/lib/booking-utils"

const STEP_MS = 5 * 60 * 1000
const HOUR_MS = 60 * 60 * 1000
const BUTTON_SIZE = 52

type CustomTimePickerProps = {
  /** Chosen start, in ms. Moves in 5-minute steps. */
  valueMs: number
  /** Soonest allowed start (now, rounded up) or the start of the day. */
  minMs: number
  /** Last allowed start (end of the day). */
  maxMs: number
  durationMinutes: number
  plan: BookingPlan | null
  isChecking: boolean
  onChange: (nextMs: number) => void
  onCheck: () => void
  onBook: () => void
  onPickSuggestion: (suggestion: BookingSuggestion) => void
}

function t(value: string | number) {
  return new Date(value).toLocaleTimeString("en-KE", { hour: "numeric", minute: "2-digit" })
}

/**
 * "Pick your own time": nudge the start in 5-minute steps (or an hour at a
 * time), then check it. A clash says when the table is busy and offers the
 * nearest times that work, one tap to take.
 */
export function CustomTimePicker({
  valueMs,
  minMs,
  maxMs,
  durationMinutes,
  plan,
  isChecking,
  onChange,
  onCheck,
  onBook,
  onPickSuggestion,
}: CustomTimePickerProps) {
  const { colors } = useAppTheme()
  const endMs = valueMs + durationMinutes * 60 * 1000
  const clamp = (next: number) => Math.min(maxMs, Math.max(minMs, next))
  const nudge = (delta: number) => {
    const next = clamp(valueMs + delta)
    if (next !== valueMs) onChange(next)
  }

  const round = (delta: number, icon: "minus" | "plus") => (
    <PressableScale
      onPress={() => nudge(delta)}
      disabled={delta < 0 ? valueMs <= minMs : valueMs >= maxMs}
      haptic="selection"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.round, { backgroundColor: colors.fill }]}
    >
      <IconSymbol name={icon} size={24} color={colors.accentText} />
    </PressableScale>
  )

  const hourButton = (delta: number, label: string) => (
    <PressableScale
      onPress={() => nudge(delta)}
      haptic="selection"
      accessibilityRole="button"
      accessibilityLabel={delta < 0 ? "One hour earlier" : "One hour later"}
      style={[styles.hourButton, { backgroundColor: colors.fill }]}
    >
      <AppText variant="subheadline" weight="600" color="accentText">
        {label}
      </AppText>
    </PressableScale>
  )

  return (
    <Card>
      <View style={styles.stack}>
        <AppText variant="headline">Pick your own time</AppText>
        <View
          style={styles.row}
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel="Start time"
          accessibilityValue={{ text: `${t(valueMs)} to ${t(endMs)}` }}
          accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
          onAccessibilityAction={(event) =>
            nudge(event.nativeEvent.actionName === "increment" ? STEP_MS : -STEP_MS)
          }
        >
          {round(-STEP_MS, "minus")}
          <View style={styles.value}>
            <AppText variant="title2" tabular>
              {t(valueMs)}
            </AppText>
            <AppText variant="footnote" color="secondaryLabel" tabular>
              to {t(endMs)} · {formatDurationLabel(durationMinutes)}
            </AppText>
          </View>
          {round(STEP_MS, "plus")}
        </View>
        <View style={styles.hourRow}>
          {hourButton(-HOUR_MS, "−1 hr")}
          {hourButton(HOUR_MS, "+1 hr")}
        </View>

        {plan?.status === "available" && plan.price ? (
          <View style={styles.stack}>
            <AppText variant="callout" accessibilityLiveRegion="polite">
              {t(plan.requested.startsAt)} – {t(plan.requested.endsAt)} is free ·{" "}
              {formatKes(plan.price.totalAmount, plan.price.currency)}
            </AppText>
            <Button label="Book this time" onPress={onBook} />
          </View>
        ) : (
          <Button
            label="Check this time"
            variant="secondary"
            loading={isChecking}
            onPress={onCheck}
          />
        )}

        {plan && plan.status !== "available" ? (
          <View style={styles.stack} accessibilityLiveRegion="polite">
            <AppText variant="callout">
              {plan.status === "past"
                ? `${t(plan.requested.startsAt)} has already passed. The soonest you can start is ${t(plan.earliestStartIso)}.`
                : `You wanted ${t(plan.requested.startsAt)} – ${t(plan.requested.endsAt)}, but ${
                    plan.conflicts.length > 0
                      ? `another group has the table ${plan.conflicts
                          .map((c) => `${t(c.startsAt)} – ${t(c.endsAt)}`)
                          .join(" and ")}`
                      : "every table is taken then"
                  }.`}
            </AppText>
            {plan.suggestions.length > 0 ? (
              <>
                <AppText variant="footnote" color="secondaryLabel">
                  You can have one of these instead
                </AppText>
                {plan.suggestions.map((suggestion) => (
                  <PressableScale
                    key={`${suggestion.startsAt}-${suggestion.durationMinutes}`}
                    onPress={() => onPickSuggestion(suggestion)}
                    haptic="selection"
                    accessibilityRole="button"
                    accessibilityLabel={`${t(suggestion.startsAt)} to ${t(suggestion.endsAt)}, ${describeSuggestion(suggestion)}, ${formatKes(suggestion.price.totalAmount, suggestion.price.currency)}`}
                    accessibilityHint="Takes this time"
                    style={[styles.suggestion, { borderColor: colors.separator, backgroundColor: colors.surface }]}
                  >
                    <View style={styles.suggestionText}>
                      <AppText variant="headline" tabular>
                        {t(suggestion.startsAt)} – {t(suggestion.endsAt)}
                      </AppText>
                      <AppText variant="footnote" color="secondaryLabel">
                        {describeSuggestion(suggestion)} ·{" "}
                        {formatKes(suggestion.price.totalAmount, suggestion.price.currency)}
                      </AppText>
                    </View>
                    <AppText variant="headline" color="accentText">
                      Take it
                    </AppText>
                  </PressableScale>
                ))}
              </>
            ) : (
              <AppText variant="footnote" color="secondaryLabel">
                Nothing close is free this day. Try another day or a shorter game.
              </AppText>
            )}
          </View>
        ) : null}
      </View>
    </Card>
  )
}

const styles = StyleSheet.create({
  stack: { gap: PlayTTSpacing.sm },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: PlayTTSpacing.md,
  },
  value: { flex: 1, alignItems: "center" },
  round: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: BUTTON_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  hourRow: { flexDirection: "row", gap: PlayTTSpacing.xs },
  hourButton: {
    flex: 1,
    paddingVertical: PlayTTSpacing.xs,
    borderRadius: 12,
    borderCurve: "continuous",
    alignItems: "center",
  },
  suggestion: {
    flexDirection: "row",
    alignItems: "center",
    gap: PlayTTSpacing.md,
    padding: PlayTTSpacing.md,
    borderRadius: 14,
    borderCurve: "continuous",
    borderWidth: StyleSheet.hairlineWidth,
  },
  suggestionText: { flex: 1, gap: 2 },
})
