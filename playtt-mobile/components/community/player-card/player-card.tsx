import * as Haptics from "expo-haptics"
import { Image } from "expo-image"
import { Handshake } from "phosphor-react-native/src/icons/Handshake"
import { useEffect, useId, useState } from "react"
import {
  AccessibilityInfo,
  Pressable,
  StyleSheet,
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
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg"

import { DefaultAvatar } from "@/components/account/default-avatar"
import { AppText } from "@/components/ui/app-text"
import { resolveColorScheme, type AppColorScheme } from "@/constants/theme"
import { PlayTTFontFamilies } from "@/constants/playtt-tokens"
import { useColorScheme } from "@/hooks/use-color-scheme"
import { resolveMediaUrl } from "@/lib/media-url"

import { CardBack } from "./card-back"
import { CardText } from "./card-text"
import { CardBackground } from "./card-background"
import { CardBadges } from "./card-badges"
import { CardShine, FoundingStamp } from "./card-foil"
import { CardStatGrid } from "./card-stat-grid"
import { AtVenueChip, CardStatusRibbon, PulseDot } from "./card-status-ribbon"
import {
  COMPACT_STAT_KEYS,
  OPEN_NOW_GREEN,
  cardTierTokensFor,
  cardVariant,
  IN_FORM_ORANGE,
  ratingLabel,
  handednessCode,
  nextTierProgress,
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
          source={{ uri: resolveMediaUrl(player.image) ?? undefined }}
          style={{ width: "100%", height: "100%" }}
          contentFit="cover"
          accessible={false}
        />
      ) : (
        <DefaultAvatar />
      )}
    </View>
  )
}

/** Linear mix of two #rrggbb colors; t = 0 → a, 1 → b. */
function mixHex(a: string, b: string, t: number) {
  const channel = (hex: string, i: number) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16)
  const mixed = [0, 1, 2].map((i) => Math.round(channel(a, i) + (channel(b, i) - channel(a, i)) * t))
  return `#${mixed.map((value) => value.toString(16).padStart(2, "0")).join("")}`
}

/**
 * Front-of-card portrait, FIFA-style: the photo sits to the right of the
 * rating column and dissolves into the card on its left and bottom edges, so
 * it reads as part of the card rather than a pasted rectangle. Without a
 * photo, their cartoon avatar in a ring sized to fit the same space.
 */
function CardPortrait({
  player,
  tokens,
  compact,
  idPrefix,
}: {
  player: PlayerCardData
  tokens: CardTierTokens
  compact: boolean
  idPrefix: string
}) {
  const uri = resolveMediaUrl(player.image)
  // Card background color behind the portrait's edges (the base gradient runs top → bottom).
  const edgeLeft = mixHex(tokens.gradient[0], tokens.gradient[1], 0.3)
  const edgeBottom = mixHex(tokens.gradient[0], tokens.gradient[1], 0.55)

  return (
    <View pointerEvents="none" style={[styles.portrait, compact ? styles.portraitCompact : styles.portraitFull]}>
      {uri ? (
        <>
          <Image
            source={{ uri }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            contentPosition="top"
            transition={180}
            accessible={false}
          />
          <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" preserveAspectRatio="none">
            <Defs>
              <LinearGradient id={`${idPrefix}-fadeX`} x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor={edgeLeft} stopOpacity={1} />
                <Stop offset="0.28" stopColor={edgeLeft} stopOpacity={0} />
              </LinearGradient>
              <LinearGradient id={`${idPrefix}-fadeY`} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0.6" stopColor={edgeBottom} stopOpacity={0} />
                <Stop offset="1" stopColor={edgeBottom} stopOpacity={1} />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${idPrefix}-fadeX)`} />
            <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${idPrefix}-fadeY)`} />
          </Svg>
        </>
      ) : (
        <View style={styles.monogramWrap}>
          <View
            style={[
              styles.monogramRing,
              compact && styles.monogramRingCompact,
              { borderColor: tokens.accent, backgroundColor: tokens.plate },
            ]}
          >
            <DefaultAvatar />
          </View>
        </View>
      )}
    </View>
  )
}

function TierProgress({ player, tokens, scheme }: { player: PlayerCardData; tokens: CardTierTokens; scheme: AppColorScheme }) {
  const progress = nextTierProgress(player, scheme)
  if (!progress) return null

  return (
    <View style={styles.progress} accessibilityLabel={progress.label}>
      <View style={[styles.progressTrack, { backgroundColor: tokens.plate }]}>
        <View style={[styles.progressFill, { width: `${progress.fraction * 100}%`, backgroundColor: tokens.accent }]} />
      </View>
      <CardText style={[styles.progressLabel, { color: tokens.muted }]}>{progress.label}</CardText>
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
          <CardAvatar player={player} tokens={tokens} size={48} />
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
        {/* A list row, not card art: system type that grows with the phone's text size. */}
        <View style={styles.miniCopy}>
          <View style={styles.miniNameRow}>
            <AppText variant="headline" numberOfLines={1} style={styles.miniName}>
              {player.displayName}
            </AppText>
            {player.relationship?.rallyPartner ? (
              <Handshake size={16} color={tokens.accent} weight="fill" />
            ) : null}
          </View>
          <View style={styles.miniMetaRow}>
            <View style={[styles.tierChip, { borderColor: tokens.accent }]}>
              <View style={[styles.tierDot, { backgroundColor: tokens.accent }]} />
              <AppText variant="footnote" weight="600">
                {tokens.name}
              </AppText>
            </View>
            {ribbon ? (
              <AppText variant="subheadline" color={ribbon.kind === "now" ? "success" : "secondaryLabel"} style={styles.miniStatus}>
                {ribbon.kind === "now" ? ribbon.label.replace("→", "until ") : `Open ${ribbon.label.toLowerCase()}`}
              </AppText>
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
  scheme,
  animate,
  idPrefix,
}: {
  player: PlayerCardData
  size: "full" | "compact"
  tokens: CardTierTokens
  scheme: AppColorScheme
  animate: boolean
  idPrefix: string
}) {
  const compact = size === "compact"
  const ribbon = statusRibbon(player.availability)
  const variant = cardVariant(player)
  const style = playStyleCode(player.playStyle)
  const hand = handednessCode(player.handedness)

  return (
    <View style={[styles.front, compact ? styles.frontCompact : styles.frontFull]}>
      {/* FIFA-style hero: rating column on the left, photo filling the rest. */}
      <View style={styles.hero}>
        <View style={[styles.ratingColumn, compact ? styles.ratingColumnCompact : styles.ratingColumnFull]}>
          {/* Rating from earned card points (wins, sessions, drills, kudos). */}
          <CardText
            numberOfLines={1}
            adjustsFontSizeToFit
            style={[styles.rating, compact && styles.ratingCompact, { color: tokens.text }]}
          >
            {ratingLabel(player)}
          </CardText>
          <CardText
            numberOfLines={1}
            adjustsFontSizeToFit
            style={[styles.tier, compact && styles.tierCompact, { color: tokens.accent }]}
          >
            {tokens.name.toUpperCase()}
          </CardText>
          {!compact && (style || hand) ? (
            <>
              <View style={[styles.columnRule, { backgroundColor: tokens.accent }]} />
              {style ? <CardText style={[styles.styleCode, { color: tokens.text }]}>{style}</CardText> : null}
              {hand ? <CardText style={[styles.styleCode, { color: tokens.muted }]}>{hand}</CardText> : null}
            </>
          ) : null}
          {!compact && variant === "founding" ? <FoundingStamp tokens={tokens} /> : null}
          {variant === "in_form" ? (
            <View style={[styles.inFormTag, { borderColor: IN_FORM_ORANGE }]}>
              {/* Orange border, readable text: orange text fails contrast on the light cards. */}
              <CardText style={[styles.inFormText, { color: tokens.text }]}>IN FORM</CardText>
            </View>
          ) : null}
        </View>
        <CardPortrait player={player} tokens={tokens} compact={compact} idPrefix={idPrefix} />
        {ribbon || player.atVenueName ? (
          <View style={styles.ribbonSlot}>
            {ribbon ? <CardStatusRibbon ribbon={ribbon} tokens={tokens} compact={compact} animate={animate} /> : null}
            {player.atVenueName ? (
              <AtVenueChip venueName={player.atVenueName} tokens={tokens} compact={compact} animate={animate} />
            ) : null}
          </View>
        ) : null}
      </View>

      <View style={[styles.namePlate, { borderColor: tokens.accent }]}>
        <CardText
          numberOfLines={1}
          adjustsFontSizeToFit
          style={[styles.name, compact && styles.nameCompact, { color: tokens.text }]}
        >
          {player.displayName.toUpperCase()}
        </CardText>
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
          <TierProgress player={player} tokens={tokens} scheme={scheme} />
          <View style={[styles.divider, { backgroundColor: tokens.muted }]} />
          <CardBadges player={player} tokens={tokens} />
          <CardText style={[styles.footer, { color: tokens.muted }]}>
            PlayTT{player.homeVenue ? ` · ${player.homeVenue.name}` : ""}
          </CardText>
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
  const shineEnabled = isFull && tier !== "blue" && !reduceMotion && !reduceTransparency && !flipped

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
          <CardFront
            player={player}
            size={isFull ? "full" : "compact"}
            tokens={tokens}
            scheme={scheme}
            animate={!reduceMotion}
            idPrefix={idPrefix}
          />
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
    // Taller, trading-card proportions leave room for the portrait.
    aspectRatio: 0.7,
  },
  compact: {
    width: "100%",
    aspectRatio: 0.7,
  },
  face: {
    backfaceVisibility: "hidden",
  },
  front: {
    flex: 1,
  },
  frontFull: {
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 14,
    gap: 8,
  },
  frontCompact: {
    paddingHorizontal: 9,
    paddingTop: 12,
    paddingBottom: 9,
    gap: 5,
  },
  hero: {
    flex: 1,
    flexDirection: "row",
    minHeight: 0,
  },
  ratingColumn: {
    alignItems: "center",
    zIndex: 1,
  },
  ratingColumnFull: {
    width: 64,
    gap: 2,
    paddingTop: 6,
  },
  ratingColumnCompact: {
    width: 36,
    gap: 1,
    paddingTop: 2,
  },
  rating: {
    fontFamily: PlayTTFontFamilies.bold,
    fontSize: 40,
    lineHeight: 42,
    letterSpacing: -1,
  },
  ratingCompact: {
    fontSize: 20,
    lineHeight: 22,
    letterSpacing: -0.5,
  },
  tier: {
    fontFamily: PlayTTFontFamilies.bold,
    fontSize: 12,
    letterSpacing: 1.2,
  },
  tierCompact: {
    fontSize: 9,
    letterSpacing: 0.6,
  },
  columnRule: {
    width: 22,
    height: 2,
    borderRadius: 1,
    marginVertical: 6,
    opacity: 0.8,
  },
  styleCode: {
    fontFamily: PlayTTFontFamilies.bold,
    fontSize: 13,
    letterSpacing: 1,
  },
  ribbonSlot: {
    position: "absolute",
    top: 0,
    right: 0,
    alignItems: "flex-end",
    gap: 4,
    zIndex: 2,
  },
  portrait: {
    flex: 1,
    overflow: "hidden",
  },
  portraitFull: {
    // Bleed toward the card's right edge and top, FIFA-style.
    marginRight: -10,
    marginTop: -6,
    borderRadius: 16,
  },
  portraitCompact: {
    marginRight: -5,
    marginTop: -4,
    borderRadius: 10,
  },
  monogramWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 6,
  },
  monogramRing: {
    // Sized from the available height so it never spills into the name.
    height: "86%",
    maxWidth: "100%",
    aspectRatio: 1,
    borderRadius: 999,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    padding: 3,
  },
  monogramRingCompact: {
    borderWidth: 1.5,
  },
  progress: {
    gap: 4,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 3,
  },
  progressLabel: {
    fontFamily: PlayTTFontFamilies.semiBold,
    fontSize: 12,
    letterSpacing: 0.4,
    textAlign: "center",
  },
  namePlate: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingBottom: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
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
    fontSize: 12,
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
    fontSize: 10,
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
    flexShrink: 1,
  },
  miniMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
  },
  tierChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1.5,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 1,
  },
  tierDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  miniStatus: {
    flexShrink: 1,
  },
})
