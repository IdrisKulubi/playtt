import { useState } from "react"
import { ScrollView, StyleSheet, View } from "react-native"

import { USUAL_TIME_LABELS } from "@/components/community/player-card/card-tiers"
import { PressableScale } from "@/components/kit/pressable-scale"
import { AppText } from "@/components/ui/app-text"
import { BottomSheet } from "@/components/ui/bottom-sheet"
import { IconSymbol } from "@/components/ui/icon-symbol"
import { KitLayout } from "@/constants/kit-layout"
import { PlayTTSpacing } from "@/constants/playtt-tokens"
import { useAppTheme } from "@/hooks/use-app-theme"
import { USUAL_TIME_KEYS, type CommunitySkillLevel, type UsualTimeKey } from "@/lib/community-types"

const SKILLS: { value: CommunitySkillLevel | null; label: string }[] = [
  { value: null, label: "All levels" },
  { value: "beginner", label: "Rookie" },
  { value: "intermediate", label: "Club" },
  { value: "pro", label: "Elite" },
]

type CommunityFilterChipsProps = {
  skill: CommunitySkillLevel | null
  doubles: boolean
  usualTime: UsualTimeKey | null
  onSkillChange: (skill: CommunitySkillLevel | null) => void
  onDoublesChange: (doubles: boolean) => void
  onUsualTimeChange: (usualTime: UsualTimeKey | null) => void
}

/** Filters for the player list: level, doubles, usual time. Selected = cyan fill plus a tick. */
export function CommunityFilterChips({
  skill,
  doubles,
  usualTime,
  onSkillChange,
  onDoublesChange,
  onUsualTimeChange,
}: CommunityFilterChipsProps) {
  const { colors } = useAppTheme()
  const [timesOpen, setTimesOpen] = useState(false)

  function chip(key: string, label: string, active: boolean, onPress: () => void, opensSheet = false) {
    return (
      <PressableScale
        key={key}
        haptic="selection"
        accessibilityState={{ selected: active }}
        accessibilityLabel={label}
        accessibilityHint={opensSheet ? "Opens a list of times" : undefined}
        onPress={onPress}
        style={[
          styles.chip,
          {
            backgroundColor: active ? colors.accent : colors.surface,
            borderColor: active ? colors.accent : colors.separator,
          },
        ]}
      >
        {active ? <IconSymbol name="checkmark" size={14} color={colors.onAccent} /> : null}
        <AppText variant="callout" weight={active ? "700" : "500"} color={active ? "onAccent" : "label"}>
          {label}
        </AppText>
        {opensSheet ? <IconSymbol name="chevron.right" size={14} color={active ? colors.onAccent : colors.secondaryLabel} /> : null}
      </PressableScale>
    )
  }

  return (
    <>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.bleed}
        contentContainerStyle={styles.row}
      >
        {SKILLS.map((option) =>
          chip(option.label, option.label, skill === option.value, () => onSkillChange(option.value)),
        )}
        {chip("doubles", "Doubles", doubles, () => onDoublesChange(!doubles))}
        {chip(
          "usual",
          usualTime ? USUAL_TIME_LABELS[usualTime] : "Usual time",
          Boolean(usualTime),
          () => setTimesOpen(true),
          true,
        )}
      </ScrollView>
      <BottomSheet visible={timesOpen} title="When do they usually play?" onClose={() => setTimesOpen(false)}>
        <View style={styles.sheet}>
          {chip("any", "Any time", usualTime === null, () => {
            onUsualTimeChange(null)
            setTimesOpen(false)
          })}
          {USUAL_TIME_KEYS.map((key) =>
            chip(key, USUAL_TIME_LABELS[key], usualTime === key, () => {
              onUsualTimeChange(key)
              setTimesOpen(false)
            }),
          )}
        </View>
      </BottomSheet>
    </>
  )
}

const styles = StyleSheet.create({
  bleed: { marginHorizontal: -KitLayout.screenGutter },
  row: { gap: PlayTTSpacing.xs, paddingHorizontal: KitLayout.screenGutter },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: PlayTTSpacing["2xs"],
    borderRadius: 24,
    borderWidth: 1,
    paddingHorizontal: PlayTTSpacing.md,
  },
  sheet: { flexDirection: "row", flexWrap: "wrap", gap: PlayTTSpacing.xs, paddingBottom: PlayTTSpacing.sm },
})
