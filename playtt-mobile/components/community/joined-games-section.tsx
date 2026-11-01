import { CalendarCheck } from "phosphor-react-native/src/icons/CalendarCheck"
import { useMemo } from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"

import { formatNairobiClock } from "@/components/community/player-card/card-tiers"
import { PlayTTColors, PlayTTFontFamilies, PlayTTSpacing } from "@/constants/playtt-tokens"
import { useProductTheme } from "@/hooks/use-product-theme"
import { chatDayLabel } from "@/lib/community-chat-merge"
import type { CommunitySharedBooking } from "@/lib/community-types"

/** Upcoming or live games I joined as a guest through Community. */
export function joinedGames(bookings: CommunitySharedBooking[]) {
  return bookings
    .filter((booking) => booking.role === "guest" && booking.phase !== "ended")
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
}

type JoinedGamesSectionProps = {
  bookings: CommunitySharedBooking[]
  onOpen: (booking: CommunitySharedBooking) => void
}

export function JoinedGamesSection({ bookings, onOpen }: JoinedGamesSectionProps) {
  const theme = useProductTheme()
  const games = joinedGames(bookings)

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: { gap: PlayTTSpacing.sm },
        title: { fontFamily: PlayTTFontFamilies.semiBold, fontSize: 15, color: theme.muted },
        card: {
          borderRadius: 16,
          borderWidth: 1,
          borderColor: theme.border,
          backgroundColor: theme.card,
          padding: PlayTTSpacing.md,
          gap: 4,
        },
        header: { flexDirection: "row", alignItems: "center", gap: 6 },
        tag: { fontFamily: PlayTTFontFamilies.bold, fontSize: 12, color: PlayTTColors.primary, letterSpacing: 0.6 },
        when: { fontFamily: PlayTTFontFamilies.semiBold, fontSize: 17, color: theme.foreground },
        where: { fontFamily: PlayTTFontFamilies.regular, fontSize: 14, color: theme.muted },
        note: { fontFamily: PlayTTFontFamilies.regular, fontSize: 12, color: theme.muted, marginTop: 2 },
      }),
    [theme],
  )

  if (games.length === 0) return null

  return (
    <View style={styles.root}>
      <Text style={styles.title}>Games you joined</Text>
      {games.map((game) => {
        const host = game.partners.find((partner) => partner.id === game.hostId) ?? game.partners[0]
        const when = `${chatDayLabel(game.startsAt)} · ${formatNairobiClock(game.startsAt)}–${formatNairobiClock(game.endsAt)}`
        return (
          <Pressable
            key={game.bookingId}
            accessibilityRole="button"
            accessibilityLabel={`Game with ${host?.displayName ?? "your partner"}, ${when}, ${game.resourceName}. Opens the chat.`}
            onPress={() => onOpen(game)}
            style={styles.card}
          >
            <View style={styles.header}>
              <CalendarCheck size={16} color={PlayTTColors.primary} weight="bold" />
              <Text style={styles.tag}>{game.phase === "live" ? "PLAYING NOW" : "YOU'RE IN"}</Text>
            </View>
            <Text style={styles.when}>{when}</Text>
            <Text style={styles.where}>
              {game.resourceName} · {game.locationName}
              {host ? ` · with ${host.displayName}` : ""}
            </Text>
            <Text style={styles.note}>{host?.displayName ?? "The host"} holds the booking and the door code.</Text>
          </Pressable>
        )
      })}
    </View>
  )
}
