import * as Haptics from "expo-haptics"
import { Image } from "expo-image"
import { Handshake } from "phosphor-react-native/src/icons/Handshake"
import { useEffect, useId, useState } from "react"
import {
  AccessibilityInfo,
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from "react-native"
import Animated, {
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated"

import { resolveColorScheme } from "@/constants/theme"
import { PlayTTFontFamilies } from "@/constants/playtt-tokens"
import { useColorScheme } from "@/hooks/use-color-scheme"

import { CardBack } from "./card-back"
import { CardBackground } from "./card-background"
import { CardBadges } from "./card-badges"
import { CardShine, FoundingStamp } from "./card-foil"
import { CardStatGrid } from "./card-stat-grid"
import { AtVenueChip, CardStatusRibbon, PulseDot } from "./card-status-ribbon"
import {
  COMPACT_STAT_KEYS,
  OPEN_NOW_GREEN,
  cardInitials,
  cardTierTokensFor,
  cardVariant,
  IN_FORM_ORANGE,
  ratingLabel,
  handednessCode,
  playStyleCode,
  playerCardAccessibilityLabel,
  statusRibbon,
  tierForPlayer,
  type CardSize,
  type CardTierTokens,
  type PlayerCardData,
} from "./card-tiers"

export type { PlayerCardData } from "./card-tiers"

type PlayerCardProps = {
  player: PlayerCardData
  size?: CardSize
  onPress?: () => void
  /** Full size only: tap flips to the back instead of calling onPress. */
  flippable?: boolean
  style?: StyleProp<ViewStyle>
}

const FLIP_MS = 450

function useReduceTransparency() {
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    let mounted = true
    void AccessibilityInfo.isReduceTransparencyEnabled?.()
      .then((value) => mounted && setEnabled(value))
      .catch(() => undefined)
    const subscription = AccessibilityInfo.addEventListener?.("reduceTransparencyChanged", setEnabled)
    return () => {
      mounted = false
      subscription?.remove()
    }
  }, [])

  return enabled
}

function CardAvatar({
  player,
  tokens,
  size,
}: {
  player: PlayerCardData
  tokens: CardTierTokens
  size: number
}) {
  const ring = Math.max(2, Math.round(size / 28))

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: ring,
        borderColor: tokens.accent,
        backgroundColor: tokens.plate,
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      {player.image ? (
        <Image
          source={{ uri: player.image }}
          style={{ width: "100%", height: "100%" }}
          contentFit="cover"
          accessible={false}
        />
      ) : (
        <Text style={{ fontFamily: PlayTTFontFamilies.bold, fontSize: size * 0.36, color: tokens.text }}>
          {cardInitials(player.displayName)}
        </Text>
      )}
    </View>
  )
}

function usePressScale(enabled: boolean) {
  const scale = useSharedValue(1)
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }))

  return {
    style,
    onPressIn() {
      if (enabled) scale.set(withTiming(0.97, { duration: 90 }))
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined)
    },
    onPressOut() {
      scale.set(withSpring(1, { damping: 14, stiffness: 260 }))
    },
  }
}

function MiniCard({ player, onPress, style }: PlayerCardProps) {
  const scheme = resolveColorScheme(useColorScheme())
  const tokens = cardTierTokensFor(player, scheme)
  const reduceMotion = useReducedMotion()
  const press = usePressScale(!reduceMotion)
  const ribbon = statusRibbon(player.availability)

  return (
    <Pressable
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={playerCardAccessibilityLabel(player)}
      onPress={onPress}
      onPressIn={onPress ? press.onPressIn : undefined}
      onPressOut={onPress ? press.onPressOut : undefined}
      disabled={!onPress}
    >
      <Animated.View style={[styles.miniRow, press.style, style]}>
        <View>
          <CardAvatar player={player} tokens={tokens} size={44} />
          {ribbon ? (
            <View style={styles.miniDot}>
              <PulseDot
                color={ribbon.kind === "now" ? OPEN_NOW_GREEN : tokens.accent}
                size={10}
                animate={!reduceMotion && ribbon.kind === "now"}
              />
            </View>
          ) : null}
        </View>
        <View style={styles.miniCopy}>
          <View style={styles.miniNameRow}>
            <Text numberOfLines={1} style={[styles.miniName, { color: scheme === "dark" ? "#fff" : "#0a1628" }]}>
              {player.displayName}
            </Text>
            {player.relationship?.rallyPartner ? (
              <Handshake size={14} color={tokens.accent} weight="fill" />
            ) : null}
          </View>
          <View style={styles.miniMetaRow}>
            <View style={[styles.tierChip, { borderColor: tokens.accent }]}>
              <Text style={[styles.tierChipText, { color: tokens.accent }]}>{tokens.name.toUpperCase()}</Text>
            </View>
            {ribbon ? (
              <Text numberOfLines={1} style={[styles.miniStatus, { color: scheme === "dark" ? "rgba(255,255,255,0.62)" : "#5a6b82" }]}>
                {ribbon.kind === "now" ? ribbon.label.replace("→", "until ") : `Open ${ribbon.label.toLowerCase()}`}
              </Text>
            ) : null}
          </View>
        </View>
      </Animated.View>
    </Pressable>
  )
}

function CardFront({
  player,
  size,
  tokens,
  animate,
}: {
  player: PlayerCardData
  size: "full" | "compact"
  tokens: CardTierTokens
  animate: boolean
}) {
  const compact = size === "compact"
  const ribbon = statusRibbon(player.availability)
  const variant = cardVariant(player)
  const style = playStyleCode(player.playStyle)
  const hand = handednessCode(player.handedness)

  return (
    <View style={[styles.front, compact ? styles.frontCompact : styles.frontFull]}>
      <View style={styles.topRow}>
        <View style={styles.ratingBlock}>
          {/* Rating from verified scoreboard results; NEW until 5 rated matches. */}
          <Text style={[styles.rating, compact && styles.ratingCompact, { color: tokens.text }]}>
            {ratingLabel(player)}
          </Text>
          <Text style={[styles.tier, compact && styles.tierCompact, { color: tokens.accent }]}>
            {tokens.name.toUpperCase()}
          </Text>
          {!compact && (style || hand) ? (
            <Text style={[styles.styleCode, { color: tokens.muted }]}>
              {[style, hand].filter(Boolean).join("  ")}
            </Text>
          ) : null}
        </View>
        <View style={styles.ribbonSlot}>
          {ribbon ? <CardStatusRibbon ribbon={ribbon} tokens={tokens} compact={compact} animate={animate} /> : null}
          {player.atVenueName ? (
            <AtVenueChip venueName={player.atVenueName} tokens={tokens} compact={compact} animate={animate} />
          ) : null}
          {!compact && variant === "founding" ? <FoundingStamp tokens={tokens} /> : null}
          {variant === "in_form" ? (
            <View style={[styles.inFormTag, { borderColor: IN_FORM_ORANGE }]}>
              <Text style={[styles.inFormText, { color: IN_FORM_ORANGE }]}>IN FORM</Text>
            </View>
          ) : null}
        </View>
      </View>

      <View style={styles.avatarSlot}>
        <CardAvatar player={player} tokens={tokens} size={compact ? 64 : 112} />
      </View>

      <View style={[styles.namePlate, { backgroundColor: tokens.plate }]}>
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          style={[styles.name, compact && styles.nameCompact, { color: tokens.text }]}
        >
          {player.displayName.toUpperCase()}
        </Text>
        {player.relationship?.rallyPartner ? <Handshake size={compact ? 12 : 16} color={tokens.accent} weight="fill" /> : null}
      </View>

      <CardStatGrid
        stats={player.stats}
        keys={compact ? COMPACT_STAT_KEYS : undefined}
        tokens={tokens}
        compact={compact}
        highlightStreak={variant === "streak"}
      />

      {!compact ? (
        <>
          <View style={[styles.divider, { backgroundColor: tokens.muted }]} />
          <CardBadges player={player} tokens={tokens} />
          <Text style={[styles.footer, { color: tokens.muted }]}>
            PlayTT{player.homeVenue ? ` · ${player.homeVenue.name}` : ""}
          </Text>
        </>
      ) : null}
    </View>
  )
}

export function PlayerCard({ player, size = "compact", onPress, flippable = false, style }: PlayerCardProps) {
  const scheme = resolveColorScheme(useColorScheme())
  const reduceMotion = useReducedMotion()
  const reduceTransparency = useReduceTransparency()
  const idPrefix = `card${useId().replace(/[^a-zA-Z0-9]/g, "")}`
  const [layout, setLayout] = useState({ width: 0, height: 0 })
  const [flipped, setFlipped] = useState(false)
  const flip = useSharedValue(0)
  const press = usePressScale(!reduceMotion)

  const tier = tierForPlayer(player)
  const tokens = cardTierTokensFor(player, scheme)
  const inForm = cardVariant(player) === "in_form"
  const isFull = size === "full"
  const canFlip = isFull && flippable

  const frontStyle = useAnimatedStyle(() => ({
    transform: [{ perspective: 1000 }, { rotateY: `${interpolate(flip.value, [0, 1], [0, 180])}deg` }],
  }))
  const backStyle = useAnimatedStyle(() => ({
    transform: [{ perspective: 1000 }, { rotateY: `${interpolate(flip.value, [0, 1], [180, 360])}deg` }],
  }))

  if (size === "mini") {
    return <MiniCard player={player} onPress={onPress} style={style} />
  }

  function handleLayout(event: LayoutChangeEvent) {
    const { width, height } = event.nativeEvent.layout
    if (width !== layout.width || height !== layout.height) {
      setLayout({ width, height })
    }
  }

  function handlePress() {
    if (canFlip) {
      const next = !flipped
      setFlipped(next)
      flip.set(reduceMotion ? (next ? 1 : 0) : withTiming(next ? 1 : 0, { duration: FLIP_MS }))
      return
    }
    onPress?.()
  }

  const interactive = canFlip || Boolean(onPress)
  const notchDepth = isFull ? 10 : 6
  const radius = isFull ? 24 : 18
  const shineEnabled = isFull && tier !== "rookie" && !reduceMotion && !reduceTransparency && !flipped

  const face = (side: "front" | "back") => (
    <Animated.View
      style={[
        StyleSheet.absoluteFill,
        styles.face,
        canFlip ? (side === "front" ? frontStyle : backStyle) : null,
      ]}
      pointerEvents="none"
    >
      <CardBackground
        width={layout.width}
        height={layout.height}
        tokens={tokens}
        radius={radius}
        notchDepth={notchDepth}
        flat={reduceTransparency}
        glowY={side === "front" ? (isFull ? 0.36 : 0.4) : 0.2}
        idPrefix={`${idPrefix}${side}`}
      />
      {side === "front" ? (
        <>
          <CardShine
            width={layout.width}
            height={layout.height}
            top={notchDepth}
            opacity={tokens.foilOpacity}
            enabled={shineEnabled}
            idPrefix={idPrefix}
          />
          <CardFront player={player} size={isFull ? "full" : "compact"} tokens={tokens} animate={!reduceMotion} />
        </>
      ) : (
        <CardBack player={player} tokens={tokens} />
      )}
    </Animated.View>
  )

  return (
    <Pressable
      accessible
      accessibilityRole={interactive ? "button" : undefined}
      accessibilityLabel={playerCardAccessibilityLabel(player)}
      accessibilityHint={canFlip ? "Flips the card" : undefined}
      onPress={interactive ? handlePress : undefined}
      onPressIn={interactive ? press.onPressIn : undefined}
      onPressOut={interactive ? press.onPressOut : undefined}
      disabled={!interactive}
      style={style}
    >
      <Animated.View
        onLayout={handleLayout}
        style={[isFull ? styles.full : styles.compact, press.style]}
        testID={`player-card-${size}`}
      >
        {face("front")}
        {canFlip ? face("back") : null}
        {/* "In form" variant: orange flame edge over the tier border. */}
        {inForm && !flipped ? (
          <View
            pointerEvents="none"
            style={[StyleSheet.absoluteFill, styles.flameEdge, { borderRadius: radius, borderColor: IN_FORM_ORANGE }]}
          />
        ) : null}
      </Animated.View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  full: {
    width: "100%",
    aspectRatio: 3 / 4,
  },
  compact: {
    width: "100%",
    aspectRatio: 0.72,
  },
  face: {
    backfaceVisibility: "hidden",
  },
  front: {
    flex: 1,
  },
  frontFull: {
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 16,
    gap: 10,
  },
  frontCompact: {
    paddingHorizontal: 10,
    paddingTop: 14,
    paddingBottom: 10,
    gap: 6,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 6,
  },
  ratingBlock: {
    gap: 0,
  },
  rating: {
    fontFamily: PlayTTFontFamilies.bold,
    fontSize: 34,
    lineHeight: 36,
    letterSpacing: -0.5,
  },
  ratingCompact: {
    fontSize: 18,
    lineHeight: 20,
  },
  tier: {
    fontFamily: PlayTTFontFamilies.bold,
    fontSize: 13,
    letterSpacing: 1.6,
  },
  tierCompact: {
    fontSize: 9,
    letterSpacing: 1.1,
  },
  styleCode: {
    fontFamily: PlayTTFontFamilies.semiBold,
    fontSize: 12,
    letterSpacing: 1,
    marginTop: 2,
  },
  ribbonSlot: {
    flex: 1,
    alignItems: "flex-end",
    gap: 6,
  },
  avatarSlot: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  namePlate: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: 8,
    paddingVertical: 5,
    paddingHorizontal: 8,
  },
  name: {
    fontFamily: PlayTTFontFamilies.bold,
    fontSize: 20,
    letterSpacing: 1.2,
    flexShrink: 1,
  },
  nameCompact: {
    fontSize: 13,
    letterSpacing: 0.6,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    opacity: 0.5,
  },
  footer: {
    fontFamily: PlayTTFontFamilies.medium,
    fontSize: 11,
    textAlign: "center",
    letterSpacing: 0.4,
  },
  inFormTag: {
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  inFormText: {
    fontFamily: PlayTTFontFamilies.bold,
    fontSize: 9,
    letterSpacing: 1.2,
  },
  flameEdge: {
    borderWidth: 2,
    opacity: 0.9,
  },
  miniRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 8,
  },
  miniDot: {
    position: "absolute",
    right: 0,
    bottom: 0,
  },
  miniCopy: {
    flex: 1,
    gap: 4,
  },
  miniNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  miniName: {
    fontFamily: PlayTTFontFamilies.semiBold,
    fontSize: 16,
    flexShrink: 1,
  },
  miniMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  tierChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 1,
  },
  tierChipText: {
    fontFamily: PlayTTFontFamilies.bold,
    fontSize: 9,
    letterSpacing: 1,
  },
  miniStatus: {
    fontFamily: PlayTTFontFamilies.medium,
    fontSize: 12,
    flexShrink: 1,
  },
})
