import type { ComponentProps } from "react"
import { StyleSheet, View } from "react-native"

import { PressableScale } from "@/components/kit/pressable-scale"
import { AppText } from "@/components/ui/app-text"
import { IconSymbol } from "@/components/ui/icon-symbol"
import { PlayTTSpacing } from "@/constants/playtt-tokens"
import { useAppTheme } from "@/hooks/use-app-theme"

type CommunityHeaderProps = {
  venueName?: string | null
  onEditCard?: () => void
  onOpenInbox?: () => void
  onInvite?: () => void
  unreadCount?: number
  requestCount?: number
}

type ActionProps = {
  icon: ComponentProps<typeof IconSymbol>["name"]
  label: string
  accessibilityLabel: string
  onPress: () => void
  badge?: string
  dot?: boolean
}

/** Labelled pill: words, not a bare icon, so everyone knows what it does. */
function HeaderAction({ icon, label, accessibilityLabel, onPress, badge, dot }: ActionProps) {
  const { colors } = useAppTheme()

  return (
    <PressableScale
      onPress={onPress}
      accessibilityLabel={accessibilityLabel}
      style={[styles.action, { backgroundColor: colors.surface }]}
    >
      <IconSymbol name={icon} size={18} color={colors.accentText} />
      <AppText variant="subheadline" weight="600" maxFontSizeMultiplier={1.5}>
        {label}
      </AppText>
      {badge ? (
        <View style={[styles.badge, { backgroundColor: colors.destructive }]}>
          <AppText variant="caption" weight="700" style={styles.badgeText} maxFontSizeMultiplier={1.3}>
            {badge}
          </AppText>
        </View>
      ) : dot ? (
        // Requests are quiet: a dot, not a number.
        <View style={[styles.dot, { backgroundColor: colors.accent }]} />
      ) : null}
    </PressableScale>
  )
}

export function CommunityHeader({
  venueName,
  onEditCard,
  onOpenInbox,
  onInvite,
  unreadCount = 0,
  requestCount = 0,
}: CommunityHeaderProps) {
  const hasActions = Boolean(onOpenInbox || onInvite || onEditCard)

  return (
    <View style={styles.root}>
      <AppText variant="largeTitle" accessibilityRole="header">
        Players
      </AppText>
      <AppText variant="subheadline" color="secondaryLabel">
        {venueName ? `Find someone to play with at ${venueName}.` : "Find someone to play with at your venue."}
      </AppText>
      {hasActions ? (
        <View style={styles.actions}>
          {onOpenInbox ? (
            <HeaderAction
              icon="bubble.left.and.bubble.right.fill"
              label="Messages"
              accessibilityLabel={inboxLabel(unreadCount, requestCount)}
              onPress={onOpenInbox}
              badge={unreadCount > 0 ? (unreadCount > 9 ? "9+" : String(unreadCount)) : undefined}
              dot={unreadCount === 0 && requestCount > 0}
            />
          ) : null}
          {onInvite ? (
            <HeaderAction icon="person.badge.plus" label="Invite" accessibilityLabel="Invite a friend" onPress={onInvite} />
          ) : null}
          {onEditCard ? (
            <HeaderAction icon="pencil" label="My card" accessibilityLabel="Edit my player card" onPress={onEditCard} />
          ) : null}
        </View>
      ) : null}
    </View>
  )
}

function inboxLabel(unread: number, requests: number) {
  const parts = ["Messages"]
  if (unread > 0) parts.push(`${unread} unread`)
  if (requests > 0) parts.push(`${requests} ${requests === 1 ? "request" : "requests"}`)
  return parts.join(", ")
}

const styles = StyleSheet.create({
  root: { gap: PlayTTSpacing["2xs"] },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: PlayTTSpacing.xs,
    marginTop: PlayTTSpacing.sm,
  },
  action: {
    flexDirection: "row",
    alignItems: "center",
    gap: PlayTTSpacing.xs,
    paddingHorizontal: PlayTTSpacing.md,
    borderRadius: 24,
  },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { color: "#FFFFFF" },
  dot: { width: 8, height: 8, borderRadius: 4 },
})
