import { UsersThree } from "phosphor-react-native/src/icons/UsersThree"
import { StyleSheet, View } from "react-native"

import { formatNairobiClock } from "@/components/community/player-card/card-tiers"
import { PressableScale } from "@/components/kit/pressable-scale"
import { AppText } from "@/components/ui/app-text"
import { PlayTTSpacing } from "@/constants/playtt-tokens"
import { useAppTheme } from "@/hooks/use-app-theme"
import { chatDayLabel, inboxTimeLabel } from "@/lib/community-chat-merge"
import type { CommunityGroup } from "@/lib/community-types"

export function groupSubtitle(group: CommunityGroup) {
  const parts = [`${group.memberCount}${group.maxMembers ? ` of ${group.maxMembers}` : ""} players`]
  if (group.startsAt) parts.push(`${chatDayLabel(group.startsAt)} ${formatNairobiClock(group.startsAt)}`)
  if (group.mutedUntil) parts.push("Muted")
  return parts.join(" · ")
}

/** One group chat in Messages (a doubles game or an event). */
export function GroupRow({ group, onPress }: { group: CommunityGroup; onPress: () => void }) {
  const { colors } = useAppTheme()
  const unread = group.unreadCount > 0
  const last = group.lastMessage
  const isEvent = group.type === "event"

  return (
    <PressableScale
      onPress={onPress}
      pressedScale={0.99}
      accessibilityLabel={`${group.title}, ${groupSubtitle(group)}${unread ? `, ${group.unreadCount} new` : ""}`}
      style={styles.row}
    >
      <View style={[styles.icon, { backgroundColor: colors.fill }]}>
        <UsersThree size={22} color={isEvent ? colors.warning : colors.accentText} weight="bold" />
      </View>
      <View style={styles.copy}>
        <AppText variant="headline" numberOfLines={1}>
          {group.title}
        </AppText>
        <AppText variant="footnote" color="secondaryLabel">
          {groupSubtitle(group)}
        </AppText>
        {last ? (
          <AppText
            variant="subheadline"
            numberOfLines={1}
            weight={unread ? "600" : undefined}
            color={unread ? "label" : "secondaryLabel"}
          >
            {last.mine ? `You: ${last.body}` : last.body}
          </AppText>
        ) : null}
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
              {group.unreadCount > 9 ? "9+" : group.unreadCount} new
            </AppText>
          </View>
        ) : null}
      </View>
    </PressableScale>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: PlayTTSpacing.sm, paddingVertical: PlayTTSpacing.sm },
  icon: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  copy: { flex: 1, gap: 2 },
  meta: { alignItems: "flex-end", gap: 6 },
  badge: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
})
