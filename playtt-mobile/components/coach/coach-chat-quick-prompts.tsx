import { ScrollView, StyleSheet } from "react-native"

import { PressableScale } from "@/components/kit/pressable-scale"
import { AppText } from "@/components/ui/app-text"
import { KitLayout } from "@/constants/kit-layout"
import { PlayTTSpacing } from "@/constants/playtt-tokens"
import { useAppTheme } from "@/hooks/use-app-theme"
import type { CoachQuickPrompt } from "@/lib/mock/mock-coach-chat"

type CoachChatQuickPromptsProps = {
  prompts: CoachQuickPrompt[]
  onSelect: (prompt: CoachQuickPrompt) => void
  disabled?: boolean
}

/** Ready-made questions for people who don't know what to ask. */
export function CoachChatQuickPrompts({ prompts, onSelect, disabled = false }: CoachChatQuickPromptsProps) {
  const { colors } = useAppTheme()

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.scroll}
      keyboardShouldPersistTaps="handled"
    >
      {prompts.map((prompt) => (
        <PressableScale
          key={prompt.id}
          disabled={disabled}
          accessibilityLabel={`Ask Coach: ${prompt.label}`}
          onPress={() => onSelect(prompt)}
          style={[styles.chip, { borderColor: colors.separator, backgroundColor: colors.surface }]}
        >
          <AppText variant="subheadline" weight="500">
            {prompt.label}
          </AppText>
        </PressableScale>
      ))}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: KitLayout.screenGutter, gap: PlayTTSpacing.xs },
  chip: { borderRadius: 24, borderWidth: 1, paddingHorizontal: PlayTTSpacing.md, justifyContent: "center" },
})
