import { ChatCircleDots } from "phosphor-react-native/src/icons/ChatCircleDots"
import { IdentificationCard } from "phosphor-react-native/src/icons/IdentificationCard"
import { UserPlus } from "phosphor-react-native/src/icons/UserPlus"
import { useMemo } from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"

import {
  PlayTTColors,
  PlayTTFontFamilies,
  PlayTTSpacing,
  PlayTTTypography,
} from "@/constants/playtt-tokens"
import { useProductTheme } from "@/hooks/use-product-theme"

type CommunityHeaderProps = {
  venueName?: string | null
  onEditCard?: () => void
  onOpenInbox?: () => void
  onInvite?: () => void
  unreadCount?: number
  requestCount?: number
}

export function CommunityHeader({
  venueName,
  onEditCard,
  onOpenInbox,
  onInvite,
  unreadCount = 0,
  requestCount = 0,
}: CommunityHeaderProps) {
  const theme = useProductTheme()

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: {
          gap: PlayTTSpacing["2xs"],
        },
        row: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: PlayTTSpacing.sm,
        },
        title: {
          ...PlayTTTypography.headline,
          fontSize: 26,
          lineHeight: 30,
          fontFamily: PlayTTFontFamilies.semiBold,
          color: theme.foreground,
          flex: 1,
        },
        venue: {
          color: theme.muted,
        },
        subtitle: {
          fontSize: 15,
          fontFamily: PlayTTFontFamilies.regular,
          color: theme.muted,
          lineHeight: 22,
        },
        iconButton: {
          width: 40,
          height: 40,
          borderRadius: 20,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: theme.elevated,
        },
        actions: {
          flexDirection: "row",
          gap: PlayTTSpacing.xs,
        },
        badge: {
          position: "absolute",
          top: -2,
          right: -2,
          minWidth: 18,
          height: 18,
          borderRadius: 9,
          paddingHorizontal: 4,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: PlayTTColors.primary,
          borderWidth: 2,
          borderColor: theme.background,
        },
        badgeText: {
          fontFamily: PlayTTFontFamilies.bold,
          fontSize: 10,
          color: PlayTTColors.primaryForeground,
        },
        requestDot: {
          position: "absolute",
          top: 0,
          right: 0,
          width: 10,
          height: 10,
          borderRadius: 5,
          backgroundColor: theme.muted,
          borderWidth: 2,
          borderColor: theme.background,
        },
      }),
    [theme],
  )

  return (
    <View style={styles.root}>
      <View style={styles.row}>
        <Text style={styles.title} numberOfLines={1} accessibilityRole="header">
          Players
          {venueName ? <Text style={styles.venue}> · {venueName}</Text> : null}
        </Text>
        <View style={styles.actions}>
          {onInvite ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Invite a friend"
              hitSlop={6}
              onPress={onInvite}
              style={styles.iconButton}
            >
              <UserPlus size={20} color={theme.foreground} />
            </Pressable>
          ) : null}
          {onOpenInbox ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={inboxLabel(unreadCount, requestCount)}
              hitSlop={6}
              onPress={onOpenInbox}
              style={styles.iconButton}
            >
              <ChatCircleDots size={20} color={theme.foreground} />
              {unreadCount > 0 ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{unreadCount > 9 ? "9+" : unreadCount}</Text>
                </View>
              ) : requestCount > 0 ? (
                // Requests are quiet: a dot, not a number.
                <View style={styles.requestDot} />
              ) : null}
            </Pressable>
          ) : null}
          {onEditCard ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Edit my player card"
              hitSlop={6}
              onPress={onEditCard}
              style={styles.iconButton}
            >
              <IdentificationCard size={20} color={theme.foreground} />
            </Pressable>
          ) : null}
        </View>
      </View>
      <Text style={styles.subtitle}>Find someone to play with at your venue.</Text>
    </View>
  )
}

function inboxLabel(unread: number, requests: number) {
  const parts = ["Messages"]
  if (unread > 0) parts.push(`${unread} unread`)
  if (requests > 0) parts.push(`${requests} ${requests === 1 ? "request" : "requests"}`)
  return parts.join(", ")
}
