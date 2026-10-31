import { Fire } from "phosphor-react-native/src/icons/Fire"
import { Handshake } from "phosphor-react-native/src/icons/Handshake"
import { Medal } from "phosphor-react-native/src/icons/Medal"
import { StyleSheet, Text, View } from "react-native"

import { PlayTTFontFamilies } from "@/constants/playtt-tokens"

import type { CardTierTokens, PlayerCardData } from "./card-tiers"

type Badge = { key: string; label: string; Icon: typeof Fire }

/** Badges earned from data we have today; kudos badges arrive in M4. */
export function cardBadges(player: PlayerCardData): Badge[] {
  const badges: Badge[] = []
  const streak = player.stats.streakWeeks ?? 0

  if (streak >= 4) badges.push({ key: "streak", label: `${streak}-week streak`, Icon: Fire })
  if (player.relationship?.rallyPartner) badges.push({ key: "rally", label: "Rally partner", Icon: Handshake })
  if (player.foundingPlayer) badges.push({ key: "founding", label: "Founding player", Icon: Medal })

  return badges.slice(0, 3)
}

export function CardBadges({ player, tokens }: { player: PlayerCardData; tokens: CardTierTokens }) {
  const badges = cardBadges(player)

  if (badges.length === 0) {
    return null
  }

  return (
    <View style={styles.row}>
      {badges.map(({ key, label, Icon }) => (
        <View key={key} style={styles.badge}>
          <Icon size={13} color={tokens.accent} weight="fill" />
          <Text numberOfLines={1} style={[styles.label, { color: tokens.muted }]}>
            {label}
          </Text>
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    columnGap: 10,
    rowGap: 4,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  label: {
    fontFamily: PlayTTFontFamilies.medium,
    fontSize: 11,
  },
})
