import { StyleSheet, View } from "react-native"

import { PlayerCard } from "@/components/community/player-card/player-card"
import { formatNairobiClock } from "@/components/community/player-card/card-tiers"
import { PressableScale } from "@/components/kit/pressable-scale"
import { AppText } from "@/components/ui/app-text"
import { PlayTTSpacing } from "@/constants/playtt-tokens"
import { useAppTheme } from "@/hooks/use-app-theme"
import { inboxTimeLabel } from "@/lib/community-chat-merge"
import type { CommunityConversation } from "@/lib/community-types"

export function conversationPreview(conversation: CommunityConversation) {
  const last = conversation.lastMessage
  if (!last) return "Say hi and agree a time"
  const text = last.kind === "booking_card" ? "Shared a booking 🏓" : last.body
  return last.mine ? `You: ${text}` : text
}

type ConversationRowProps = {
  conversation: CommunityConversation
  onPress: () => void
}

/** One chat in Messages: who, the last message, when, and how many are new (in words, not just a dot). */
export function ConversationRow({ conversation, onPress }: ConversationRowProps) {
  const { colors } = useAppTheme()
  const unread = conversation.unreadCount > 0
  const last = conversation.lastMessage

  const label = [
    conversation.player.displayName,
    unread ? `${conversation.unreadCount} new` : null,
    conversationPreview(conversation),
  ]
    .filter(Boolean)
    .join(", ")

  return (
    <PressableScale onPress={onPress} pressedScale={0.99} accessibilityLabel={label} style={styles.press}>
      <View style={styles.row} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <View style={styles.card}>
          <PlayerCard player={conversation.player} size="mini" />
        </View>
        <View style={styles.meta}>
          {last ? (
            <AppText variant="footnote" color={unread ? "accentText" : "secondaryLabel"} weight={unread ? "600" : undefined}>
              {inboxTimeLabel(last.createdAt, formatNairobiClock)}
            </AppText>
          ) : null}
          {unread ? (
            <View style={[styles.badge, { backgroundColor: colors.accent }]}>
              <AppText variant="caption" weight="700" color="onAccent">
                {conversation.unreadCount > 9 ? "9+" : conversation.unreadCount} new
              </AppText>
            </View>
          ) : null}
        </View>
      </View>
      <AppText
        variant="subheadline"
        numberOfLines={2}
        weight={unread ? "600" : undefined}
        color={unread ? "label" : "secondaryLabel"}
        style={styles.preview}
      >
        {conversationPreview(conversation)}
      </AppText>
    </PressableScale>
  )
}

const styles = StyleSheet.create({
  press: { paddingVertical: PlayTTSpacing.xs },
  row: { flexDirection: "row", alignItems: "center", gap: PlayTTSpacing.sm },
  card: { flex: 1 },
  meta: { alignItems: "flex-end", gap: 6, minWidth: 56 },
  badge: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  preview: { marginLeft: 56, marginTop: -4 },
})
