import { StyleSheet, Text, View } from "react-native"

import { PlayTTFontFamilies } from "@/constants/playtt-tokens"
import { KUDOS_EMOJI, KUDOS_LABELS } from "@/lib/community-types"

import {
  USUAL_TIME_LABELS,
  headToHeadLine,
  playStyleName,
  type CardTierTokens,
  type PlayerCardData,
} from "./card-tiers"

type CardBackProps = {
  player: PlayerCardData
  tokens: CardTierTokens
}

export function CardBack({ player, tokens }: CardBackProps) {
  const details = [
    player.playStyle ? playStyleName(player.playStyle) : null,
    player.handedness ? (player.handedness === "left" ? "Left-handed" : "Right-handed") : null,
  ].filter(Boolean)

  return (
    <View style={styles.root}>
      <Text style={[styles.name, { color: tokens.text }]}>{player.displayName}</Text>
      {details.length > 0 ? (
        <Text style={[styles.meta, { color: tokens.muted }]}>{details.join(" · ")}</Text>
      ) : null}

      <View style={styles.section}>
        <Text style={[styles.heading, { color: tokens.accent }]}>ABOUT</Text>
        <Text style={[styles.body, { color: player.bio ? tokens.text : tokens.muted }]}>
          {player.bio ?? "No bio yet."}
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={[styles.heading, { color: tokens.accent }]}>USUALLY PLAYS</Text>
        {player.usualTimes.length > 0 ? (
          <View style={styles.chips}>
            {player.usualTimes.map((key) => (
              <View key={key} style={[styles.chip, { backgroundColor: tokens.plate }]}>
                <Text style={[styles.chipText, { color: tokens.text }]}>{USUAL_TIME_LABELS[key]}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={[styles.body, { color: tokens.muted }]}>Not set yet.</Text>
        )}
      </View>

      {headToHeadLine(player.headToHead, player.displayName) ? (
        <View style={styles.section}>
          <Text style={[styles.heading, { color: tokens.accent }]}>HEAD-TO-HEAD</Text>
          <Text style={[styles.body, { color: tokens.text }]}>
            {headToHeadLine(player.headToHead, player.displayName)}
          </Text>
        </View>
      ) : null}

      {player.kudos && player.kudos.length > 0 ? (
        <View style={styles.section}>
          <Text style={[styles.heading, { color: tokens.accent }]}>KUDOS</Text>
          <View style={styles.chips}>
            {player.kudos.map((entry) => (
              <View key={entry.type} style={[styles.chip, { backgroundColor: tokens.plate }]}>
                <Text style={[styles.chipText, { color: tokens.text }]}>
                  {KUDOS_EMOJI[entry.type]} {KUDOS_LABELS[entry.type]} · {entry.count}
                </Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      <View style={styles.footer}>
        <Text style={[styles.footerText, { color: tokens.muted }]}>
          PlayTT{player.homeVenue ? ` · ${player.homeVenue.name}` : ""}
        </Text>
        <Text style={[styles.footerText, { color: tokens.muted }]}>Tap to flip</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingHorizontal: 22,
    paddingTop: 30,
    paddingBottom: 18,
    gap: 6,
  },
  name: {
    fontFamily: PlayTTFontFamilies.bold,
    fontSize: 22,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  meta: {
    fontFamily: PlayTTFontFamilies.medium,
    fontSize: 13,
  },
  section: {
    gap: 6,
    marginTop: 12,
  },
  heading: {
    fontFamily: PlayTTFontFamilies.bold,
    fontSize: 11,
    letterSpacing: 1.2,
  },
  body: {
    fontFamily: PlayTTFontFamilies.regular,
    fontSize: 14,
    lineHeight: 20,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  chip: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  chipText: {
    fontFamily: PlayTTFontFamilies.medium,
    fontSize: 12,
  },
  footer: {
    marginTop: "auto",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  footerText: {
    fontFamily: PlayTTFontFamilies.medium,
    fontSize: 11,
  },
})
