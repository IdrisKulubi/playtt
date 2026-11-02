import { ScrollView, StyleSheet, View } from "react-native"

import { PlayerCard } from "@/components/community/player-card/player-card"
import { Button } from "@/components/kit/button"
import { AppText } from "@/components/ui/app-text"
import { KitLayout } from "@/constants/kit-layout"
import { PlayTTSpacing } from "@/constants/playtt-tokens"
import type { CommunityPlayer } from "@/lib/community-types"

type RallyPartnersRowProps = {
  players: CommunityPlayer[]
  onOpenPlayer: (player: CommunityPlayer) => void
  onLetsPlay: (player: CommunityPlayer) => void
}

/** Players you follow each other with or have played with: one tap to chat. */
export function RallyPartnersRow({ players, onOpenPlayer, onLetsPlay }: RallyPartnersRowProps) {
  if (players.length === 0) return null

  return (
    <View style={styles.root}>
      <View>
        <AppText variant="title2" accessibilityRole="header">
          Your rally partners
        </AppText>
        <AppText variant="subheadline" color="secondaryLabel">
          People you&apos;ve played with or follow back
        </AppText>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.bleed}
        contentContainerStyle={styles.row}
      >
        {players.map((player) => (
          <View key={player.id} style={styles.item}>
            <PlayerCard player={player} size="mini" onPress={() => onOpenPlayer(player)} />
            {player.relationship.canMessage ? (
              <Button
                label="Let's play"
                accessibilityLabel={`Let's play with ${player.displayName}`}
                onPress={() => onLetsPlay(player)}
              />
            ) : null}
          </View>
        ))}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { gap: PlayTTSpacing.sm },
  bleed: { marginHorizontal: -KitLayout.screenGutter },
  row: { gap: PlayTTSpacing.sm, paddingHorizontal: KitLayout.screenGutter },
  item: { width: 190, gap: PlayTTSpacing.xs },
})
