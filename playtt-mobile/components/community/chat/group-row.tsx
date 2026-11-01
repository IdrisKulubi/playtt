import { UsersThree } from "phosphor-react-native/src/icons/UsersThree"
import { useMemo } from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"

import { formatNairobiClock } from "@/components/community/player-card/card-tiers"
import { PlayTTColors, PlayTTFontFamilies, PlayTTSpacing } from "@/constants/playtt-tokens"
import { useProductTheme } from "@/hooks/use-product-theme"
import { chatDayLabel, inboxTimeLabel } from "@/lib/community-chat-merge"
import type { CommunityGroup } from "@/lib/community-types"

export function groupSubtitle(group: CommunityGroup) {
  const parts = [`${group.memberCount}${group.maxMembers ? `/${group.maxMembers}` : ""} players`]
  if (group.startsAt) parts.push(`${chatDayLabel(group.startsAt)} ${formatNairobiClock(group.startsAt)}`)
  if (group.mutedUntil) parts.push("Muted")
  return parts.join(" · ")
}

export function GroupRow({ group, onPress }: { group: CommunityGroup; onPress: () => void }) {
  const theme = useProductTheme()
  const unread = group.unreadCount > 0
  const last = group.lastMessage

  const styles = useMemo(
    () =>
      StyleSheet.create({
        row: { flexDirection: "row", alignItems: "center", gap: PlayTTSpacing.sm, paddingVertical: PlayTTSpacing.sm },
        icon: {
          width: 44,
          height: 44,
          borderRadius: 22,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: group.type === "event" ? "rgba(245, 200, 76, 0.16)" : "rgba(0, 183, 255, 0.14)",
        },
        copy: { flex: 1, gap: 2 },
        title: { fontFamily: PlayTTFontFamilies.semiBold, fontSize: 16, color: theme.foreground },
        subtitle: { fontFamily: PlayTTFontFamilies.regular, fontSize: 12, color: theme.muted },
        preview: {
          fontFamily: unread ? PlayTTFontFamilies.semiBold : PlayTTFontFamilies.regular,
          fontSize: 14,
          color: unread ? theme.foreground : theme.muted,
        },
        meta: { alignItems: "flex-end", gap: 6 },
        time: { fontFamily: PlayTTFontFamilies.regular, fontSize: 12, color: unread ? PlayTTColors.primary : theme.muted },
        dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: PlayTTColors.primary },
      }),
    [group.type, theme, unread],
  )

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${group.title}, ${groupSubtitle(group)}${unread ? `, ${group.unreadCount} unread` : ""}`}
      onPress={onPress}
      style={styles.row}
    >
      <View style={styles.icon}>
        <UsersThree size={20} color={group.type === "event" ? "#f5c84c" : PlayTTColors.primary} weight="bold" />
      </View>
      <View style={styles.copy}>
        <Text style={styles.title} numberOfLines={1}>
          {group.title}
        </Text>
        <Text style={styles.subtitle}>{groupSubtitle(group)}</Text>
        {last ? (
          <Text style={styles.preview} numberOfLines={1}>
            {last.mine ? `You: ${last.body}` : last.body}
          </Text>
        ) : null}
      </View>
      <View style={styles.meta}>
        {last ? <Text style={styles.time}>{inboxTimeLabel(last.createdAt, formatNairobiClock)}</Text> : null}
        {unread ? <View style={styles.dot} /> : null}
      </View>
    </Pressable>
  )
}
