import { ScrollView, StyleSheet, View } from "react-native"
import { useReducedMotion } from "react-native-reanimated"

import { PlayerCard } from "@/components/community/player-card/player-card"
import { AppText } from "@/components/ui/app-text"
import { KitLayout } from "@/constants/kit-layout"
import { PlayTTSpacing } from "@/constants/playtt-tokens"
import { useAppTheme } from "@/hooks/use-app-theme"
import type { CommunityAtVenue, CommunityPlayer } from "@/lib/community-types"

import { PulseDot } from "./player-card/card-status-ribbon"

type AtVenueStripProps = {
  atVenue: CommunityAtVenue | null
  onOpenPlayer: (player: CommunityPlayer) => void
}

/** "3 playing at Parklands now" + compact cards. Hidden when nobody opted in. */
export function AtVenueStrip({ atVenue, onOpenPlayer }: AtVenueStripProps) {
  const { colors } = useAppTheme()
  const reduceMotion = useReducedMotion()

  if (!atVenue || atVenue.count === 0) return null

  const venueName = atVenue.venue.name.replace(/^PlayTT\s+/i, "")

  return (
    <View style={styles.root}>
      <View style={styles.title}>
        <PulseDot color={colors.success} animate={!reduceMotion} size={10} />
        <AppText variant="title2" accessibilityRole="header" style={styles.flex}>
          {atVenue.count} playing at {venueName} now
        </AppText>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.bleed}
        contentContainerStyle={styles.row}
      >
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

const styles = StyleSheet.create({
  root: { gap: PlayTTSpacing.sm },
  title: { flexDirection: "row", alignItems: "center", gap: PlayTTSpacing.xs },
  flex: { flex: 1 },
  bleed: { marginHorizontal: -KitLayout.screenGutter },
  row: { gap: PlayTTSpacing.sm, paddingHorizontal: KitLayout.screenGutter },
  card: { width: 168 },
})
