import { StyleSheet, View } from "react-native"

import { AppText } from "@/components/ui/app-text"
import { KitLayout } from "@/constants/kit-layout"
import { PlayTTSpacing } from "@/constants/playtt-tokens"
import { useAppTheme } from "@/hooks/use-app-theme"
import type { CoachChatMessage } from "@/lib/mock/mock-coach-chat"

type CoachChatMessageBubbleProps = {
  message: CoachChatMessage
}

/** Coach on the left (with its name), you on the right, same look as player chats. */
export function CoachChatMessageBubble({ message }: CoachChatMessageBubbleProps) {
  const { colors } = useAppTheme()
  const isCoach = message.role === "coach"

  return (
    <View style={[styles.row, { justifyContent: isCoach ? "flex-start" : "flex-end" }]}>
      <View
        style={[
          styles.bubble,
          isCoach ? styles.bubbleCoach : styles.bubbleMine,
          {
            backgroundColor: isCoach ? colors.surface : colors.fill,
            borderColor: colors.separator,
            borderWidth: isCoach ? StyleSheet.hairlineWidth : 0,
          },
        ]}
      >
        {isCoach ? (
          <AppText variant="footnote" weight="600" color="accentText" style={styles.label}>
            Coach
          </AppText>
        ) : null}
        <AppText variant="body">{message.text}</AppText>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", paddingHorizontal: KitLayout.screenGutter, marginBottom: PlayTTSpacing.sm },
  bubble: {
    maxWidth: "84%",
    borderRadius: 20,
    paddingHorizontal: PlayTTSpacing.md,
    paddingVertical: PlayTTSpacing.sm,
  },
  bubbleCoach: { borderBottomLeftRadius: 6 },
  bubbleMine: { borderBottomRightRadius: 6 },
  label: { marginBottom: 2 },
})
