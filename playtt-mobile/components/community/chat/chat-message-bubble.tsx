import { CalendarCheck } from "phosphor-react-native/src/icons/CalendarCheck"
import { memo, useMemo } from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"

import { formatNairobiClock } from "@/components/community/player-card/card-tiers"
import { PlayTTColors, PlayTTFontFamilies, PlayTTSpacing } from "@/constants/playtt-tokens"
import { useProductTheme } from "@/hooks/use-product-theme"
import { chatDayLabel, isBookingCard, type ChatItem } from "@/lib/community-chat-merge"

type ChatMessageBubbleProps = {
  item: ChatItem
  seen: boolean
  onLongPress?: (item: ChatItem) => void
  onRetry?: (item: ChatItem) => void
  onOpenBooking?: (bookingId: string) => void
  /** For a booking card the other player shared: whether I've joined it. */
  joinState?: "can_join" | "joined" | null
  onJoin?: (bookingId: string) => void
  onLeave?: (bookingId: string) => void
  onGiveKudos?: (bookingId: string) => void
  onPlayAgain?: () => void
}

function bookingWhen(startsAt: string, endsAt: string) {
  return `${chatDayLabel(startsAt)} · ${formatNairobiClock(startsAt)}–${formatNairobiClock(endsAt)}`
}

export const ChatMessageBubble = memo(function ChatMessageBubble({
  item,
  seen,
  onLongPress,
  onRetry,
  onOpenBooking,
  joinState = null,
  onJoin,
  onLeave,
  onGiveKudos,
  onPlayAgain,
}: ChatMessageBubbleProps) {
  const theme = useProductTheme()
  const mine = item.mine

  const styles = useMemo(
    () =>
      StyleSheet.create({
        row: {
          flexDirection: "row",
          justifyContent: mine ? "flex-end" : "flex-start",
          paddingHorizontal: PlayTTSpacing.md,
          marginBottom: 6,
        },
        column: { maxWidth: "80%", alignItems: mine ? "flex-end" : "flex-start", gap: 2 },
        bubble: {
          borderRadius: 18,
          borderBottomRightRadius: mine ? 6 : 18,
          borderBottomLeftRadius: mine ? 18 : 6,
          paddingHorizontal: PlayTTSpacing.md,
          paddingVertical: 9,
          backgroundColor: mine ? "rgba(0, 183, 255, 0.18)" : theme.elevated,
          borderWidth: mine ? 0 : StyleSheet.hairlineWidth,
          borderColor: theme.border,
          opacity: item.status === "sending" ? 0.6 : 1,
        },
        quick: { borderWidth: 1, borderColor: PlayTTColors.primary },
        text: { fontFamily: PlayTTFontFamilies.regular, fontSize: 15, lineHeight: 21, color: theme.foreground },
        meta: { fontFamily: PlayTTFontFamilies.regular, fontSize: 11, color: theme.muted },
        failed: { fontFamily: PlayTTFontFamilies.semiBold, fontSize: 12, color: PlayTTColors.destructive },
        card: {
          width: 240,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: PlayTTColors.primary,
          backgroundColor: theme.card,
          padding: PlayTTSpacing.sm,
          gap: 4,
        },
        cardHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
        cardTitle: { fontFamily: PlayTTFontFamilies.bold, fontSize: 13, color: PlayTTColors.primary, letterSpacing: 0.6 },
        cardWhen: { fontFamily: PlayTTFontFamilies.semiBold, fontSize: 16, color: theme.foreground },
        cardWhere: { fontFamily: PlayTTFontFamilies.regular, fontSize: 13, color: theme.muted },
        cardAction: { fontFamily: PlayTTFontFamilies.semiBold, fontSize: 13, color: PlayTTColors.primary, marginTop: 4 },
        prompt: {
          alignSelf: "center",
          width: "86%",
          borderRadius: 16,
          borderWidth: 1,
          borderColor: theme.border,
          backgroundColor: theme.card,
          padding: PlayTTSpacing.md,
          gap: 6,
          marginVertical: PlayTTSpacing.xs,
        },
        promptTitle: { fontFamily: PlayTTFontFamilies.bold, fontSize: 16, color: theme.foreground, textAlign: "center" },
        promptBody: { fontFamily: PlayTTFontFamilies.regular, fontSize: 13, color: theme.muted, textAlign: "center" },
        promptRow: { flexDirection: "row", gap: PlayTTSpacing.xs, justifyContent: "center", marginTop: 4 },
        promptButton: {
          borderRadius: 999,
          borderWidth: 1,
          borderColor: theme.border,
          paddingHorizontal: PlayTTSpacing.md,
          paddingVertical: 8,
        },
        promptPrimary: { backgroundColor: PlayTTColors.primary, borderColor: PlayTTColors.primary },
        promptPrimaryText: { fontFamily: PlayTTFontFamilies.semiBold, fontSize: 14, color: PlayTTColors.primaryForeground },
        promptButtonText: { fontFamily: PlayTTFontFamilies.semiBold, fontSize: 14, color: theme.foreground },
        joinButton: { alignSelf: "flex-start", marginTop: 6 },
        joinedRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 6 },
        joinedText: { fontFamily: PlayTTFontFamilies.semiBold, fontSize: 13, color: "#2ee87a" },
        leaveText: { fontFamily: PlayTTFontFamilies.medium, fontSize: 13, color: theme.muted },
        system: {
          alignSelf: "center",
          fontFamily: PlayTTFontFamilies.medium,
          fontSize: 12,
          color: theme.muted,
          marginVertical: PlayTTSpacing.xs,
        },
      }),
    [item.status, mine, theme],
  )

  if (item.kind === "system") {
    return <Text style={styles.system}>{item.body}</Text>
  }

  if (item.kind === "kudos_prompt") {
    const bookingId = item.payload && typeof item.payload === "object" ? String(item.payload.bookingId ?? "") : ""
    return (
      <View style={styles.prompt}>
        <Text style={styles.promptTitle}>How was your match? 🏓</Text>
        <Text style={styles.promptBody}>Give kudos for what you enjoyed, or line up a rematch.</Text>
        <View style={styles.promptRow}>
          <Pressable
            accessibilityRole="button"
            disabled={!bookingId}
            onPress={() => onGiveKudos?.(bookingId)}
            style={[styles.promptButton, styles.promptPrimary]}
          >
            <Text style={styles.promptPrimaryText}>Give kudos</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => onPlayAgain?.()} style={styles.promptButton}>
            <Text style={styles.promptButtonText}>Play again</Text>
          </Pressable>
        </View>
      </View>
    )
  }

  const time = formatNairobiClock(item.createdAt)
  const status =
    item.status === "sending" ? "Sending…" : item.status === "failed" ? null : seen ? `${time} · Seen` : time

  let content
  if (item.kind === "booking_card" && isBookingCard(item.payload)) {
    const booking = item.payload
    content = (
      <Pressable
        accessibilityRole={mine ? "button" : undefined}
        accessibilityLabel={`Booking: ${booking.resourceName}, ${bookingWhen(booking.startsAt, booking.endsAt)}, ${booking.locationName}`}
        disabled={!mine || !onOpenBooking}
        onPress={() => onOpenBooking?.(booking.bookingId)}
        onLongPress={() => onLongPress?.(item)}
        style={styles.card}
      >
        <View style={styles.cardHeader}>
          <CalendarCheck size={16} color={PlayTTColors.primary} weight="bold" />
          <Text style={styles.cardTitle}>TABLE BOOKED</Text>
        </View>
        <Text style={styles.cardWhen}>{bookingWhen(booking.startsAt, booking.endsAt)}</Text>
        <Text style={styles.cardWhere}>
          {booking.resourceName} · {booking.locationName}
        </Text>
        {mine ? <Text style={styles.cardAction}>View booking</Text> : null}
        {!mine && joinState === "can_join" ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="I'm in: join this booking"
            onPress={() => onJoin?.(booking.bookingId)}
            style={[styles.promptButton, styles.promptPrimary, styles.joinButton]}
          >
            <Text style={styles.promptPrimaryText}>I&apos;m in</Text>
          </Pressable>
        ) : null}
        {!mine && joinState === "joined" ? (
          <View style={styles.joinedRow}>
            <Text style={styles.joinedText}>You&apos;re in ✓</Text>
            <Pressable accessibilityRole="button" hitSlop={6} onPress={() => onLeave?.(booking.bookingId)}>
              <Text style={styles.leaveText}>Can&apos;t make it</Text>
            </Pressable>
          </View>
        ) : null}
      </Pressable>
    )
  } else {
    content = (
      <Pressable
        onLongPress={() => onLongPress?.(item)}
        delayLongPress={350}
        style={[styles.bubble, item.kind === "quick_reply" && styles.quick]}
      >
        <Text style={styles.text}>{item.body}</Text>
      </Pressable>
    )
  }

  return (
    <View style={styles.row}>
      <View style={styles.column}>
        {content}
        {item.status === "failed" ? (
          <Pressable accessibilityRole="button" onPress={() => onRetry?.(item)} hitSlop={6}>
            <Text style={styles.failed}>Not sent · Tap to retry</Text>
          </Pressable>
        ) : (
          <Text style={styles.meta}>{status}</Text>
        )}
      </View>
    </View>
  )
})
