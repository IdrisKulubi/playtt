import { useMemo } from "react"
import { Pressable, Text, View } from "react-native"

import { CoachProductSplit } from "@/components/coach/coach-product-split"
import { createActivityHeaderStyles } from "@/components/activity/activity-screen-styles"
import { PreviewBadge } from "@/components/ui/preview-badge"
import {
  PlayTTColors,
  PlayTTFontFamilies,
} from "@/constants/playtt-tokens"
import { useProductTheme } from "@/hooks/use-product-theme"
import type { CoachSegment, CoachStatus } from "@/lib/coach-types"

type CoachHeaderProps = {
  segment: Exclude<CoachSegment, "chat">
  status: CoachStatus
  clipBalance?: number | null
  onBuyClips?: () => void
}

const INTRO_COPY: Record<Exclude<CoachSegment, "chat">, string> = {
  insights: "What to work on from your clips",
  training: "Drills picked for your game",
}

function formatRenewalLabel(iso: string | null) {
  if (!iso) {
    return null
  }

  return new Date(iso).toLocaleDateString("en-KE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

export function CoachHeader({
  segment,
  status,
  clipBalance,
  onBuyClips,
}: CoachHeaderProps) {
  const theme = useProductTheme()
  const styles = useMemo(() => createActivityHeaderStyles(theme), [theme])

  const clipLabel =
    clipBalance === null || clipBalance === undefined
      ? null
      : clipBalance === 1
        ? "1 clip left"
        : `${clipBalance} clips left`

  const renewal = formatRenewalLabel(status.currentPeriodEnd)

  return (
    <View style={styles.band}>
      <View style={styles.topRow}>
        <Text style={styles.leadHeadline}>Coach</Text>
        <PreviewBadge />
      </View>
      <Text style={styles.intro}>{INTRO_COPY[segment]}</Text>

      {status.isActive && renewal ? (
        <Text style={styles.leadSubline}>
          Active until {renewal}
          {status.cancelAtPeriodEnd ? " · Cancels at period end" : ""}
        </Text>
      ) : null}

      {clipLabel && onBuyClips ? (
        <Pressable onPress={onBuyClips} style={styles.hairlineRow}>
          <Text style={styles.hairlineLabel}>{clipLabel}</Text>
          <Text
            style={{
              fontSize: 14,
              fontFamily: PlayTTFontFamilies.semiBold,
              color: PlayTTColors.primary,
            }}
          >
            Buy clips
          </Text>
        </Pressable>
      ) : null}

      {!status.isActive ? <CoachProductSplit /> : null}
    </View>
  )
}
