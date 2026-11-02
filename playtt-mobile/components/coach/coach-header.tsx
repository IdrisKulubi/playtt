import { StyleSheet, View } from "react-native"

import { CoachProductSplit } from "@/components/coach/coach-product-split"
import { ListRow } from "@/components/kit/list-row"
import { ListSection } from "@/components/kit/list-section"
import { AppText } from "@/components/ui/app-text"
import { PreviewBadge } from "@/components/ui/preview-badge"
import { PlayTTSpacing } from "@/constants/playtt-tokens"
import type { CoachSegment, CoachStatus } from "@/lib/coach-types"

type CoachHeaderProps = {
  segment: Exclude<CoachSegment, "chat">
  status: CoachStatus
  clipBalance?: number | null
  onBuyClips?: () => void
}

const INTRO_COPY: Record<Exclude<CoachSegment, "chat">, string> = {
  insights: "What to work on, from your replays",
  training: "Drills picked for your game",
}

function formatRenewalLabel(iso: string | null) {
  if (!iso) return null
  return new Date(iso).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" })
}

function replaysLeft(balance: number) {
  if (balance === 0) return "No replays left"
  return balance === 1 ? "1 replay left" : `${balance} replays left`
}

/**
 * Top of Insights and Training. The screen already says "Coach" in its large
 * title, so this only adds what's useful: what you're looking at, your plan,
 * and your replay credits.
 */
export function CoachHeader({ segment, status, clipBalance, onBuyClips }: CoachHeaderProps) {
  const renewal = formatRenewalLabel(status.currentPeriodEnd)

  return (
    <View style={styles.root}>
      <View style={styles.introRow}>
        <AppText variant="title3" accessibilityRole="header" style={styles.flex}>
          {INTRO_COPY[segment]}
        </AppText>
        <PreviewBadge />
      </View>

      {status.isActive && renewal ? (
        <AppText variant="callout" color="secondaryLabel">
          Coach is on until {renewal}
          {status.cancelAtPeriodEnd ? ". It won't renew." : "."}
        </AppText>
      ) : null}

      {clipBalance !== null && clipBalance !== undefined && onBuyClips ? (
        <ListSection>
          <ListRow
            icon="film.stack"
            title={replaysLeft(clipBalance)}
            subtitle="Buy more replays"
            accessibilityHint="Opens replay packs"
            onPress={onBuyClips}
          />
        </ListSection>
      ) : null}

      {!status.isActive ? <CoachProductSplit /> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  root: { gap: PlayTTSpacing.sm },
  introRow: { flexDirection: "row", alignItems: "center", gap: PlayTTSpacing.sm },
  flex: { flex: 1 },
})
