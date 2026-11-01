import { CheckCircle } from "phosphor-react-native/src/icons/CheckCircle"
import { Fire } from "phosphor-react-native/src/icons/Fire"
import { Handshake } from "phosphor-react-native/src/icons/Handshake"
import { Medal } from "phosphor-react-native/src/icons/Medal"
import { Star } from "phosphor-react-native/src/icons/Star"
import { StyleSheet, Text, View } from "react-native"

import { PlayTTFontFamilies } from "@/constants/playtt-tokens"

import { BADGE_LABELS, type CardTierTokens, type PlayerCardData } from "./card-tiers"

type Badge = { key: string; label: string; Icon: typeof Fire }

/**
 * Up to 3 badges, most meaningful first: earned server badges (kudos
 * thresholds, Reliable), then streak, Rally partner and Founding.
 */
export function cardBadges(player: PlayerCardData): Badge[] {
  const badges: Badge[] = []
  const streak = player.stats.streakWeeks ?? 0

  for (const key of player.badges ?? []) {
    const label = BADGE_LABELS[key]
    if (!label) continue
    badges.push({ key, label, Icon: key === "reliable" ? CheckCircle : Star })
  }

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
