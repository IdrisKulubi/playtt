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
