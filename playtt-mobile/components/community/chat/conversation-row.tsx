import { useMemo } from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"

import { PlayerCard } from "@/components/community/player-card/player-card"
import { formatNairobiClock } from "@/components/community/player-card/card-tiers"
import { PlayTTColors, PlayTTFontFamilies, PlayTTSpacing } from "@/constants/playtt-tokens"
import { useProductTheme } from "@/hooks/use-product-theme"
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

export function ConversationRow({ conversation, onPress }: ConversationRowProps) {
  const theme = useProductTheme()
  const unread = conversation.unreadCount > 0
  const last = conversation.lastMessage

  const styles = useMemo(
    () =>
      StyleSheet.create({
        row: { flexDirection: "row", alignItems: "center", gap: PlayTTSpacing.sm, paddingVertical: PlayTTSpacing.xs },
        card: { flex: 1 },
        meta: { alignItems: "flex-end", gap: 6, minWidth: 48 },
        time: { fontFamily: PlayTTFontFamilies.regular, fontSize: 12, color: unread ? PlayTTColors.primary : theme.muted },
        dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: PlayTTColors.primary },
        preview: {
          fontFamily: unread ? PlayTTFontFamilies.semiBold : PlayTTFontFamilies.regular,
          fontSize: 14,
          color: unread ? theme.foreground : theme.muted,
          marginLeft: 56,
          marginTop: -6,
          paddingBottom: PlayTTSpacing.xs,
        },
      }),
    [theme, unread],
  )

  const label = [
    conversation.player.displayName,
    unread ? `${conversation.unreadCount} unread` : null,
    conversationPreview(conversation),
  ]
    .filter(Boolean)
    .join(", ")

  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress}>
      <View style={styles.row} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <View style={styles.card}>
          <PlayerCard player={conversation.player} size="mini" />
        </View>
        <View style={styles.meta}>
          {last ? <Text style={styles.time}>{inboxTimeLabel(last.createdAt, formatNairobiClock)}</Text> : null}
          {unread ? <View style={styles.dot} /> : null}
        </View>
      </View>
      <Text numberOfLines={1} style={styles.preview}>
        {conversationPreview(conversation)}
      </Text>
    </Pressable>
  )
}
