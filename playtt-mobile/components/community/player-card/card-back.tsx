import { StyleSheet, View } from "react-native"
import { CardText } from "./card-text"

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
      <CardText style={[styles.name, { color: tokens.text }]}>{player.displayName}</CardText>
      {details.length > 0 ? (
        <CardText style={[styles.meta, { color: tokens.muted }]}>{details.join(" · ")}</CardText>
      ) : null}

      <View style={styles.section}>
        <CardText style={[styles.heading, { color: tokens.accent }]}>ABOUT</CardText>
        <CardText style={[styles.body, { color: player.bio ? tokens.text : tokens.muted }]}>
          {player.bio ?? "No bio yet."}
        </CardText>
      </View>

      <View style={styles.section}>
        <CardText style={[styles.heading, { color: tokens.accent }]}>USUALLY PLAYS</CardText>
        {player.usualTimes.length > 0 ? (
          <View style={styles.chips}>
            {player.usualTimes.map((key) => (
              <View key={key} style={[styles.chip, { backgroundColor: tokens.plate }]}>
                <CardText style={[styles.chipText, { color: tokens.text }]}>{USUAL_TIME_LABELS[key]}</CardText>
              </View>
            ))}
          </View>
        ) : (
          <CardText style={[styles.body, { color: tokens.muted }]}>Not set yet.</CardText>
        )}
      </View>

      {headToHeadLine(player.headToHead, player.displayName) ? (
        <View style={styles.section}>
          <CardText style={[styles.heading, { color: tokens.accent }]}>HEAD-TO-HEAD</CardText>
          <CardText style={[styles.body, { color: tokens.text }]}>
            {headToHeadLine(player.headToHead, player.displayName)}
          </CardText>
        </View>
      ) : null}

      {player.kudos && player.kudos.length > 0 ? (
        <View style={styles.section}>
          <CardText style={[styles.heading, { color: tokens.accent }]}>KUDOS</CardText>
          <View style={styles.chips}>
            {player.kudos.map((entry) => (
              <View key={entry.type} style={[styles.chip, { backgroundColor: tokens.plate }]}>
                <CardText style={[styles.chipText, { color: tokens.text }]}>
                  {KUDOS_EMOJI[entry.type]} {KUDOS_LABELS[entry.type]} · {entry.count}
                </CardText>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      <View style={styles.footer}>
        <CardText style={[styles.footerText, { color: tokens.muted }]}>
          PlayTT{player.homeVenue ? ` · ${player.homeVenue.name}` : ""}
        </CardText>
        <CardText style={[styles.footerText, { color: tokens.muted }]}>Tap to flip</CardText>
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
    fontSize: 12,
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
    fontSize: 12,
  },
})
