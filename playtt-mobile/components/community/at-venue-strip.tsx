import { useMemo } from "react"
import { ScrollView, StyleSheet, Text, View } from "react-native"
import { useReducedMotion } from "react-native-reanimated"

import { PlayerCard } from "@/components/community/player-card/player-card"
import { PlayTTFontFamilies, PlayTTSpacing } from "@/constants/playtt-tokens"
import { useProductTheme } from "@/hooks/use-product-theme"
import type { CommunityAtVenue, CommunityPlayer } from "@/lib/community-types"

import { OPEN_NOW_GREEN } from "./player-card/card-tiers"
import { PulseDot } from "./player-card/card-status-ribbon"

type AtVenueStripProps = {
  atVenue: CommunityAtVenue | null
  onOpenPlayer: (player: CommunityPlayer) => void
}

/** "3 playing at Parklands now" + compact cards. Hidden when nobody opted in. */
export function AtVenueStrip({ atVenue, onOpenPlayer }: AtVenueStripProps) {
  const theme = useProductTheme()
  const reduceMotion = useReducedMotion()

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: { gap: PlayTTSpacing.xs },
        title: { flexDirection: "row", alignItems: "center", gap: PlayTTSpacing.xs },
        titleText: { fontFamily: PlayTTFontFamilies.semiBold, fontSize: 15, color: theme.foreground },
        row: { gap: PlayTTSpacing.sm, paddingRight: PlayTTSpacing.md },
        card: { width: 150 },
      }),
    [theme],
  )

  if (!atVenue || atVenue.count === 0) return null

  const venueName = atVenue.venue.name.replace(/^PlayTT\s+/i, "")

  return (
    <View style={styles.root}>
      <View style={styles.title} accessibilityRole="header">
        <PulseDot color={OPEN_NOW_GREEN} animate={!reduceMotion} size={9} />
        <Text style={styles.titleText}>
          {atVenue.count} playing at {venueName} now
        </Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {atVenue.players.map((player) => (
          <View key={player.id} style={styles.card}>
            <PlayerCard
              player={{ ...player, atVenueName: atVenue.venue.name }}
              size="compact"
              onPress={() => onOpenPlayer(player)}
            />
          </View>
        ))}
      </ScrollView>
    </View>
  )
}
