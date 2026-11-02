import { CalendarCheck } from "phosphor-react-native/src/icons/CalendarCheck"
import { memo } from "react"
import { Pressable, StyleSheet, View } from "react-native"

import { formatNairobiClock } from "@/components/community/player-card/card-tiers"
import { Button } from "@/components/kit/button"
import { PressableScale } from "@/components/kit/pressable-scale"
import { AppText } from "@/components/ui/app-text"
import { IconSymbol } from "@/components/ui/icon-symbol"
import { PlayTTSpacing } from "@/constants/playtt-tokens"
import { useAppTheme } from "@/hooks/use-app-theme"
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
  /** Shown above other people's messages in group chats. */
  senderName?: string | null
  /** Host's booking card after the game started: record scoreboard sides (M5). */
  sidesLabel?: string | null
  onRecordSides?: (bookingId: string) => void
}

function bookingWhen(startsAt: string, endsAt: string) {
  return `${chatDayLabel(startsAt)} · ${formatNairobiClock(startsAt)} to ${formatNairobiClock(endsAt)}`
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
  senderName,
  sidesLabel = null,
  onRecordSides,
}: ChatMessageBubbleProps) {
  const { colors } = useAppTheme()
  const mine = item.mine

  if (item.kind === "system") {
    return (
      <AppText variant="footnote" color="secondaryLabel" style={styles.system}>
        {item.body}
      </AppText>
    )
  }

  if (item.kind === "kudos_prompt") {
    const bookingId = item.payload && typeof item.payload === "object" ? String(item.payload.bookingId ?? "") : ""
    return (
      <View style={[styles.prompt, { backgroundColor: colors.surface, borderColor: colors.separator }]}>
        <AppText variant="headline" style={styles.center}>
          How was your match? 🏓
        </AppText>
        <AppText variant="callout" color="secondaryLabel" style={styles.center}>
          Give kudos for what you enjoyed, or line up a rematch.
        </AppText>
        <View style={styles.promptRow}>
          <Button
            label="Give kudos"
            fullWidth={false}
            disabled={!bookingId}
            onPress={() => onGiveKudos?.(bookingId)}
            style={styles.promptButton}
          />
          <Button label="Play again" variant="secondary" fullWidth={false} onPress={() => onPlayAgain?.()} style={styles.promptButton} />
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
    const when = bookingWhen(booking.startsAt, booking.endsAt)
    content = (
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.accent }]}>
        <Pressable
          accessibilityRole={mine ? "button" : undefined}
          accessibilityLabel={`Booking: ${booking.resourceName}, ${when}, ${booking.locationName}`}
          accessibilityHint={mine && onOpenBooking ? "Opens the booking" : undefined}
          disabled={!mine || !onOpenBooking}
          onPress={() => onOpenBooking?.(booking.bookingId)}
          onLongPress={() => onLongPress?.(item)}
          style={styles.cardBody}
        >
          <View style={styles.cardHeader}>
            <CalendarCheck size={18} color={colors.accentText} weight="bold" />
            <AppText variant="footnote" weight="700" color="accentText">
              Table booked
            </AppText>
          </View>
          <AppText variant="headline">{when}</AppText>
          <AppText variant="callout" color="secondaryLabel">
            {booking.resourceName} · {booking.locationName}
          </AppText>
          {mine && onOpenBooking ? (
            <AppText variant="callout" weight="600" color="accentText">
              View booking
            </AppText>
          ) : null}
        </Pressable>
        {mine && sidesLabel ? (
          <Button
            label={sidesLabel}
            variant="plain"
            disabled={!onRecordSides}
            onPress={() => onRecordSides?.(booking.bookingId)}
          />
        ) : null}
        {!mine && joinState === "can_join" ? (
          <Button
            label="I'm in"
            accessibilityLabel="I'm in: join this booking"
            onPress={() => onJoin?.(booking.bookingId)}
          />
        ) : null}
        {!mine && joinState === "joined" ? (
          <View style={styles.joinedRow}>
            <View style={styles.joined}>
              <IconSymbol name="checkmark.circle.fill" size={18} color={colors.success} />
              <AppText variant="callout" weight="600" color="success">
                You&apos;re in
              </AppText>
            </View>
            <Button
              label="Can't make it"
              variant="plain"
              fullWidth={false}
              onPress={() => onLeave?.(booking.bookingId)}
            />
          </View>
        ) : null}
      </View>
    )
  } else {
    content = (
      <Pressable
        onLongPress={() => onLongPress?.(item)}
        delayLongPress={350}
        accessibilityHint={onLongPress ? "Long press for options" : undefined}
        style={[
          styles.bubble,
          mine ? styles.bubbleMine : styles.bubbleTheirs,
          {
            backgroundColor: mine ? colors.fill : colors.surface,
            borderColor: item.kind === "quick_reply" ? colors.accent : colors.separator,
            borderWidth: item.kind === "quick_reply" ? 1.5 : mine ? 0 : StyleSheet.hairlineWidth,
            opacity: item.status === "sending" ? 0.6 : 1,
          },
        ]}
      >
        <AppText variant="body">{item.body}</AppText>
      </Pressable>
    )
  }

  return (
    <View style={[styles.row, { justifyContent: mine ? "flex-end" : "flex-start" }]}>
      <View style={[styles.column, { alignItems: mine ? "flex-end" : "flex-start" }]}>
        {senderName && !mine ? (
          <AppText variant="footnote" weight="600" color="accentText" style={styles.sender}>
            {senderName}
          </AppText>
        ) : null}
        {content}
        {item.status === "failed" ? (
          <PressableScale onPress={() => onRetry?.(item)} accessibilityLabel="Message not sent. Tap to try again" style={styles.retry}>
            <IconSymbol name="exclamationmark.triangle.fill" size={14} color={colors.destructive} />
            <AppText variant="footnote" weight="600" color="destructive">
              Not sent · Tap to try again
            </AppText>
          </PressableScale>
        ) : (
          <AppText variant="caption" color="secondaryLabel">
            {status}
          </AppText>
        )}
      </View>
    </View>
  )
})

const styles = StyleSheet.create({
  row: { flexDirection: "row", paddingHorizontal: PlayTTSpacing.md, marginBottom: PlayTTSpacing.xs },
  column: { maxWidth: "82%", gap: 2 },
  center: { textAlign: "center" },
  bubble: {
    borderRadius: 20,
    paddingHorizontal: PlayTTSpacing.md,
    paddingVertical: PlayTTSpacing.xs + 2,
  },
  bubbleMine: { borderBottomRightRadius: 6 },
  bubbleTheirs: { borderBottomLeftRadius: 6 },
  sender: { marginLeft: 4 },
  card: { width: 260, borderRadius: 16, borderWidth: 1.5, padding: PlayTTSpacing.sm, gap: PlayTTSpacing.xs },
  cardBody: { gap: 2 },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  joinedRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" },
  joined: { flexDirection: "row", alignItems: "center", gap: 4 },
  prompt: {
    alignSelf: "center",
    width: "90%",
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: PlayTTSpacing.md,
    gap: PlayTTSpacing.xs,
    marginVertical: PlayTTSpacing.xs,
  },
  promptRow: { flexDirection: "row", flexWrap: "wrap", gap: PlayTTSpacing.xs, justifyContent: "center", marginTop: 4 },
  promptButton: { flexGrow: 1 },
  system: { alignSelf: "center", textAlign: "center", marginVertical: PlayTTSpacing.xs, paddingHorizontal: PlayTTSpacing.lg },
  retry: { flexDirection: "row", alignItems: "center", gap: 4 },
})
