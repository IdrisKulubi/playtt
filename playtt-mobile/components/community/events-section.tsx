import { CalendarStar } from "phosphor-react-native/src/icons/CalendarStar"
import { useMemo } from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"

import { formatNairobiClock } from "@/components/community/player-card/card-tiers"
import { PlayTTColors, PlayTTFontFamilies, PlayTTSpacing } from "@/constants/playtt-tokens"
import { useProductTheme } from "@/hooks/use-product-theme"
import { chatDayLabel } from "@/lib/community-chat-merge"
import type { CommunityEvent } from "@/lib/community-types"

const GOLD = "#f5c84c"

type EventsSectionProps = {
  events: CommunityEvent[]
  onJoin: (event: CommunityEvent) => void
  onOpen: (event: CommunityEvent) => void
}

/** Upcoming events at my venue, e.g. "King of the Table · Fri 7 PM". */
export function EventsSection({ events, onJoin, onOpen }: EventsSectionProps) {
  const theme = useProductTheme()

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: { gap: PlayTTSpacing.xs },
        heading: { fontFamily: PlayTTFontFamilies.semiBold, fontSize: 15, color: theme.foreground },
        card: {
          borderRadius: 16,
          borderWidth: 1,
          borderColor: "rgba(245, 200, 76, 0.45)",
          backgroundColor: "rgba(245, 200, 76, 0.08)",
          padding: PlayTTSpacing.md,
          gap: 4,
        },
        top: { flexDirection: "row", alignItems: "center", gap: 6 },
        title: { flex: 1, fontFamily: PlayTTFontFamilies.bold, fontSize: 16, color: theme.foreground },
        when: { fontFamily: PlayTTFontFamilies.semiBold, fontSize: 13, color: GOLD },
        description: { fontFamily: PlayTTFontFamilies.regular, fontSize: 13, color: theme.muted, lineHeight: 18 },
        footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4 },
        count: { fontFamily: PlayTTFontFamilies.medium, fontSize: 12, color: theme.muted },
        button: { borderRadius: 999, paddingHorizontal: PlayTTSpacing.md, paddingVertical: 7, backgroundColor: GOLD },
        buttonText: { fontFamily: PlayTTFontFamilies.semiBold, fontSize: 13, color: "#1b1405" },
        joined: { fontFamily: PlayTTFontFamilies.semiBold, fontSize: 13, color: PlayTTColors.primary },
      }),
    [theme],
  )

  if (events.length === 0) return null

  return (
    <View style={styles.root}>
      <Text style={styles.heading} accessibilityRole="header">
        Events
      </Text>
      {events.map((event) => {
        const full = event.maxMembers !== null && event.memberCount >= event.maxMembers
        const when = event.startsAt ? `${chatDayLabel(event.startsAt)} · ${formatNairobiClock(event.startsAt)}` : null
        return (
          <Pressable
            key={event.id}
            accessibilityRole="button"
            accessibilityLabel={`${event.title}${when ? `, ${when}` : ""}`}
            disabled={!event.joined}
            onPress={() => onOpen(event)}
            style={styles.card}
          >
            <View style={styles.top}>
              <CalendarStar size={18} color={GOLD} weight="fill" />
              <Text style={styles.title} numberOfLines={1}>
                {event.title}
              </Text>
            </View>
            {when ? <Text style={styles.when}>{when}</Text> : null}
            {event.description ? (
              <Text style={styles.description} numberOfLines={2}>
                {event.description}
              </Text>
            ) : null}
            <View style={styles.footer}>
              <Text style={styles.count}>
                {event.memberCount}
                {event.maxMembers ? `/${event.maxMembers}` : ""} going
              </Text>
              {event.joined ? (
                <Text style={styles.joined}>You&apos;re going · Open chat</Text>
              ) : full ? (
                <Text style={styles.count}>Full</Text>
              ) : (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Join ${event.title}`}
                  onPress={() => onJoin(event)}
                  style={styles.button}
                >
                  <Text style={styles.buttonText}>Join</Text>
                </Pressable>
              )}
            </View>
          </Pressable>
        )
      })}
    </View>
  )
}
