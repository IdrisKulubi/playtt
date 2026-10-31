import { useMemo } from "react"
import { Pressable, ScrollView, StyleSheet, Text } from "react-native"

import { liquidGlassLabelColor, liquidGlassSelectionChipColor } from "@/components/ui/liquid-glass-chrome"
import { PlayTTFontFamilies, PlayTTSpacing } from "@/constants/playtt-tokens"
import { resolveColorScheme } from "@/constants/theme"
import { useColorScheme } from "@/hooks/use-color-scheme"
import { useProductTheme } from "@/hooks/use-product-theme"
import type { CommunitySkillLevel } from "@/lib/community-types"

const SKILLS: { value: CommunitySkillLevel | null; label: string }[] = [
  { value: null, label: "All levels" },
  { value: "beginner", label: "Rookie" },
  { value: "intermediate", label: "Club" },
  { value: "pro", label: "Elite" },
]

type CommunityFilterChipsProps = {
  skill: CommunitySkillLevel | null
  doubles: boolean
  onSkillChange: (skill: CommunitySkillLevel | null) => void
  onDoublesChange: (doubles: boolean) => void
}

export function CommunityFilterChips({ skill, doubles, onSkillChange, onDoublesChange }: CommunityFilterChipsProps) {
  const theme = useProductTheme()
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
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {SKILLS.map((option) =>
        chip(option.label, option.label, skill === option.value, () => onSkillChange(option.value)),
      )}
      {chip("doubles", "2v2", doubles, () => onDoublesChange(!doubles))}
    </ScrollView>
  )
}
