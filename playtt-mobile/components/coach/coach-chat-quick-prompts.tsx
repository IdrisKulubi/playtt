import { useMemo } from "react"
import { Pressable, ScrollView, StyleSheet, Text } from "react-native"

import {
  PlayTTFontFamilies,
  PlayTTSpacing,
  PlayTTRadius,
} from "@/constants/playtt-tokens"
import { useProductTheme } from "@/hooks/use-product-theme"
import type { CoachQuickPrompt } from "@/lib/mock/mock-coach-chat"

type CoachChatQuickPromptsProps = {
  prompts: CoachQuickPrompt[]
  onSelect: (prompt: CoachQuickPrompt) => void
  disabled?: boolean
}

export function CoachChatQuickPrompts({
  prompts,
  onSelect,
  disabled = false,
}: CoachChatQuickPromptsProps) {
  const theme = useProductTheme()

  const styles = useMemo(
    () =>
      StyleSheet.create({
        scroll: {
          paddingHorizontal: PlayTTSpacing.xl,
          gap: PlayTTSpacing.xs,
        },
        chip: {
          borderRadius: PlayTTRadius.pill,
          borderWidth: 1,
          borderColor: theme.border,
          backgroundColor: theme.card,
          paddingHorizontal: PlayTTSpacing.sm,
          paddingVertical: 6,
        },
        chipPressed: {
          opacity: 0.7,
        },
        chipDisabled: {
          opacity: 0.45,
        },
        label: {
          fontSize: 12,
          fontFamily: PlayTTFontFamilies.medium,
          color: theme.foreground,
        },
      }),
    [theme],
  )

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.scroll}
      keyboardShouldPersistTaps="handled"
    >
      {prompts.map((prompt) => (
        <Pressable
          key={prompt.id}
          disabled={disabled}
          onPress={() => onSelect(prompt)}
          style={({ pressed }) => [
            styles.chip,
            disabled && styles.chipDisabled,
            pressed && !disabled && styles.chipPressed,
          ]}
        >
          <Text style={styles.label}>{prompt.label}</Text>
        </Pressable>
      ))}
    </ScrollView>
  )
}
