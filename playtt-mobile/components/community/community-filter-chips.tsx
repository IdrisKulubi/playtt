import { useMemo, useState } from "react"
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native"

import { USUAL_TIME_LABELS } from "@/components/community/player-card/card-tiers"
import { BottomSheet } from "@/components/ui/bottom-sheet"
import { liquidGlassLabelColor, liquidGlassSelectionChipColor } from "@/components/ui/liquid-glass-chrome"
import { PlayTTFontFamilies, PlayTTSpacing } from "@/constants/playtt-tokens"
import { resolveColorScheme } from "@/constants/theme"
import { useColorScheme } from "@/hooks/use-color-scheme"
import { useProductTheme } from "@/hooks/use-product-theme"
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

export function CommunityFilterChips({
  skill,
  doubles,
  usualTime,
  onSkillChange,
  onDoublesChange,
  onUsualTimeChange,
}: CommunityFilterChipsProps) {
  const theme = useProductTheme()
  const [timesOpen, setTimesOpen] = useState(false)
  const colorScheme = resolveColorScheme(useColorScheme())

  const styles = useMemo(
    () =>
      StyleSheet.create({
        row: { gap: PlayTTSpacing.xs, paddingRight: PlayTTSpacing.md },
        chip: {
          borderRadius: 999,
          paddingHorizontal: PlayTTSpacing.sm,
          paddingVertical: 7,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: theme.border,
        },
        chipActive: {
          backgroundColor: liquidGlassSelectionChipColor(colorScheme),
          borderColor: "transparent",
        },
        label: { fontFamily: PlayTTFontFamilies.medium, fontSize: 13 },
        sheet: { flexDirection: "row", flexWrap: "wrap", gap: PlayTTSpacing.xs },
      }),
    [colorScheme, theme],
  )

  function chip(key: string, label: string, active: boolean, onPress: () => void) {
    return (
      <Pressable
        key={key}
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
        onPress={onPress}
        style={[styles.chip, active && styles.chipActive]}
      >
        <Text style={[styles.label, { color: liquidGlassLabelColor(colorScheme, active) }]}>{label}</Text>
      </Pressable>
    )
  }

  return (
    <>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {SKILLS.map((option) =>
          chip(option.label, option.label, skill === option.value, () => onSkillChange(option.value)),
        )}
        {chip("doubles", "2v2", doubles, () => onDoublesChange(!doubles))}
        {chip("usual", usualTime ? USUAL_TIME_LABELS[usualTime] : "Usual time", Boolean(usualTime), () =>
          setTimesOpen(true),
        )}
      </ScrollView>
      <BottomSheet visible={timesOpen} title="Usually plays" onClose={() => setTimesOpen(false)}>
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
