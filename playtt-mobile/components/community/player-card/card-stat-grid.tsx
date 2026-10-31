import { StyleSheet, Text, View } from "react-native"

import { PlayTTFontFamilies } from "@/constants/playtt-tokens"
import type { CommunityCardStats } from "@/lib/community-types"

import {
  EMPTY_STAT,
  STAT_SLOTS,
  formatStat,
  type CardTierTokens,
  type StatKey,
} from "./card-tiers"

type CardStatGridProps = {
  stats: CommunityCardStats
  keys?: StatKey[]
  tokens: CardTierTokens
  compact?: boolean
  /** Highlights the STK slot for the Streak variant. */
  highlightStreak?: boolean
}

export function CardStatGrid({ stats, keys, tokens, compact = false, highlightStreak = false }: CardStatGridProps) {
  const slots = keys ? STAT_SLOTS.filter((slot) => keys.includes(slot.key)) : STAT_SLOTS

  return (
    <View style={styles.grid}>
      {slots.map((slot) => {
        const value = formatStat(stats[slot.key])
        const empty = value === EMPTY_STAT
        const highlighted = highlightStreak && slot.key === "streakWeeks"

        return (
          <View key={slot.key} style={styles.slot}>
            <Text
              style={[
                styles.value,
                compact && styles.valueCompact,
                { color: empty ? tokens.muted : highlighted ? tokens.accent : tokens.text },
              ]}
            >
              {value}
            </Text>
            <Text style={[styles.code, compact && styles.codeCompact, { color: tokens.muted }]}>
              {slot.code}
            </Text>
          </View>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    rowGap: 6,
  },
  slot: {
    width: "33.33%",
    alignItems: "center",
  },
  value: {
    fontFamily: PlayTTFontFamilies.bold,
    fontSize: 20,
    lineHeight: 24,
  },
  valueCompact: {
    fontSize: 15,
    lineHeight: 18,
  },
  code: {
    fontFamily: PlayTTFontFamilies.semiBold,
    fontSize: 10,
    letterSpacing: 0.8,
  },
  codeCompact: {
    fontSize: 9,
  },
})
