import { useMemo } from "react"
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native"

import { PlayerCard } from "@/components/community/player-card/player-card"
import { PlayTTColors, PlayTTFontFamilies, PlayTTRadius, PlayTTSpacing } from "@/constants/playtt-tokens"
import { useProductTheme } from "@/hooks/use-product-theme"
import type { CommunityPlayer } from "@/lib/community-types"

type RallyPartnersRowProps = {
  players: CommunityPlayer[]
  onOpenPlayer: (player: CommunityPlayer) => void
  onLetsPlay: (player: CommunityPlayer) => void
}

/** Players you follow each other with or have played with: one tap to chat. */
export function RallyPartnersRow({ players, onOpenPlayer, onLetsPlay }: RallyPartnersRowProps) {
  const theme = useProductTheme()

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: { gap: PlayTTSpacing.xs },
        title: { fontFamily: PlayTTFontFamilies.semiBold, fontSize: 15, color: theme.foreground },
        row: { gap: PlayTTSpacing.sm, paddingRight: PlayTTSpacing.md },
        item: {
          width: 190,
          borderRadius: 16,
          backgroundColor: theme.elevated,
          paddingHorizontal: PlayTTSpacing.sm,
          paddingBottom: PlayTTSpacing.sm,
          gap: 4,
        },
        play: {
          alignSelf: "flex-start",
          borderRadius: PlayTTRadius.pill,
          backgroundColor: PlayTTColors.primary,
          paddingHorizontal: PlayTTSpacing.sm,
          paddingVertical: 6,
        },
        playText: { fontFamily: PlayTTFontFamilies.semiBold, fontSize: 13, color: PlayTTColors.primaryForeground },
      }),
    [theme],
  )

  if (players.length === 0) return null

  return (
    <View style={styles.root}>
      <Text style={styles.title} accessibilityRole="header">
        Rally Partners
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {players.map((player) => (
          <View key={player.id} style={styles.item}>
            <PlayerCard player={player} size="mini" onPress={() => onOpenPlayer(player)} />
            {player.relationship.canMessage ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Let's play with ${player.displayName}`}
                onPress={() => onLetsPlay(player)}
                style={styles.play}
              >
                <Text style={styles.playText}>Let&apos;s play</Text>
              </Pressable>
            ) : null}
          </View>
        ))}
      </ScrollView>
    </View>
  )
}
