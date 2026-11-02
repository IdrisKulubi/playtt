import { useCallback, useEffect, useState } from "react"
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { CoachChatPanel } from "@/components/coach/coach-chat-panel"
import { CoachHeader } from "@/components/coach/coach-header"
import { CoachInsightsPanel } from "@/components/coach/coach-insights-panel"
import { ClipPackPurchaseSheet } from "@/components/coach/clip-pack-purchase-sheet"
import { CoachSubscribeSheet } from "@/components/coach/coach-subscribe-sheet"
import { CoachSubscriptionBand } from "@/components/coach/coach-subscription-band"
import { CoachTrainingPanel } from "@/components/coach/coach-training-panel"
import { ChoiceChips } from "@/components/kit/choice-chips"
import { EmptyState } from "@/components/kit/empty-state"
import { Skeleton, SkeletonGate } from "@/components/ui/skeleton"
import { KitLayout } from "@/constants/kit-layout"
import { PlayTTSpacing } from "@/constants/playtt-tokens"
import {
  fetchCoachInsights,
  fetchCoachStatus,
  fetchCoachTraining,
} from "@/lib/coach-api"
import type { CoachInsight, CoachSegment, CoachStatus, CoachTrainingItem } from "@/lib/coach-types"
import { fetchReplayCredits } from "@/lib/replay-credits-api"
import { useAppTheme } from "@/hooks/use-app-theme"
import { useSkeletonSurface } from "@/hooks/use-product-theme"

export type { CoachSegment } from "@/lib/coach-types"

function CoachScreenSkeleton() {
  const surface = useSkeletonSurface()
  return (
    <View style={styles.skeleton}>
      <Skeleton surface={surface} height={96} borderRadius={20} />
      <Skeleton surface={surface} height={56} borderRadius={12} />
      <Skeleton surface={surface} height={56} borderRadius={12} />
    </View>
  )
}

type CoachHomePanelProps = {
  isActive: boolean
}

export function CoachHomePanel({ isActive }: CoachHomePanelProps) {
  const { colors } = useAppTheme()
  const insets = useSafeAreaInsets()
  const [segment, setSegment] = useState<CoachSegment>("chat")
  const [status, setStatus] = useState<CoachStatus | null>(null)
  const [insights, setInsights] = useState<CoachInsight[]>([])
  const [training, setTraining] = useState<CoachTrainingItem[]>([])
  const [clipBalance, setClipBalance] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [clipSheetOpen, setClipSheetOpen] = useState(false)
  const [subscribeSheetOpen, setSubscribeSheetOpen] = useState(false)
  const [hasLoaded, setHasLoaded] = useState(false)

  const loadCoach = useCallback(async (silent = false) => {
    if (silent) {
      setIsRefreshing(true)
    } else {
      setIsLoading(true)
    }
    setLoadError(false)

    try {
      const [nextStatus, nextInsights, nextTraining, credits] = await Promise.all([
        fetchCoachStatus(),
        fetchCoachInsights(),
        fetchCoachTraining(),
        fetchReplayCredits(),
      ])
      setStatus(nextStatus)
      setInsights(nextInsights)
      setTraining(nextTraining)
      setClipBalance(credits.balance)
      setHasLoaded(true)
    } catch {
      setLoadError(true)
      setStatus(null)
      setInsights([])
      setTraining([])
      setClipBalance(null)
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [])

  useEffect(() => {
    if (isActive && !hasLoaded) {
      void loadCoach()
    }
  }, [hasLoaded, isActive, loadCoach])

  const coachStatus = status ?? {
    isActive: false,
    planLabel: "Coach",
    monthlyPriceKes: 0,
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
  }

  // Three clearly different jobs, so they stay as a choice at the top.
  const segmentControl = (
    <View style={styles.segment}>
      <ChoiceChips
        label="Show"
        options={[
          { value: "chat" as const, label: "Chat" },
          { value: "insights" as const, label: "Insights" },
          { value: "training" as const, label: "Training" },
        ]}
        value={segment}
        onChange={setSegment}
      />
    </View>
  )

  return (
    <>
      <View style={styles.root}>
        {segmentControl}

        {segment === "chat" ? (
          <CoachChatPanel />
        ) : (
          <ScrollView
            contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + PlayTTSpacing.xl }]}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={() => void loadCoach(true)}
                tintColor={colors.secondaryLabel}
              />
            }
          >
            <SkeletonGate loading={isLoading} skeleton={<CoachScreenSkeleton />}>
              {loadError ? (
                <EmptyState
                  icon="exclamationmark.triangle.fill"
                  title="Coach couldn't load"
                  message="Check your connection, then try again."
                  action={{ label: "Try again", onPress: () => void loadCoach() }}
                />
              ) : (
                <>
                  <CoachHeader
                    segment={segment}
                    status={coachStatus}
                    clipBalance={clipBalance}
                    onBuyClips={() => setClipSheetOpen(true)}
                  />

                  <CoachSubscriptionBand
                    status={coachStatus}
                    onSubscribe={() => setSubscribeSheetOpen(true)}
                  />

                  {segment === "insights" ? (
                    <CoachInsightsPanel insights={insights} status={coachStatus} />
                  ) : (
                    <CoachTrainingPanel
                      items={training}
                      status={coachStatus}
                      onViewInsights={() => setSegment("insights")}
                    />
                  )}
                </>
              )}
            </SkeletonGate>
          </ScrollView>
        )}
      </View>

      <ClipPackPurchaseSheet
        visible={clipSheetOpen}
        onClose={() => setClipSheetOpen(false)}
        onPurchased={() => void loadCoach(true)}
      />
      <CoachSubscribeSheet
        visible={subscribeSheetOpen}
        onClose={() => setSubscribeSheetOpen(false)}
        onSubscribed={() => void loadCoach(true)}
      />
    </>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  segment: { paddingHorizontal: KitLayout.screenGutter, paddingTop: PlayTTSpacing.xs, paddingBottom: PlayTTSpacing.xs },
  scroll: { paddingHorizontal: KitLayout.screenGutter, paddingTop: PlayTTSpacing.md, gap: PlayTTSpacing.lg },
  skeleton: { gap: PlayTTSpacing.md },
})
