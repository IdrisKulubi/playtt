import { useFocusEffect } from "expo-router"
import { useCallback, useMemo, useState } from "react"
import { RefreshControl, ScrollView, Text, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"

import { CoachHeader } from "@/components/coach/coach-header"
import { CoachInsightsPanel } from "@/components/coach/coach-insights-panel"
import { ClipPackPurchaseSheet } from "@/components/coach/clip-pack-purchase-sheet"
import { CoachSubscribeSheet } from "@/components/coach/coach-subscribe-sheet"
import { CoachSubscriptionBand } from "@/components/coach/coach-subscription-band"
import { CoachTrainingPanel } from "@/components/coach/coach-training-panel"
import { createAppScreenStyles } from "@/components/layout/app-screen-styles"
import { Button } from "@/components/ui/button"
import { SegmentControl } from "@/components/ui/segment-control"
import { SkeletonGate } from "@/components/ui/skeleton"
import {
  PlayTTFontFamilies,
  PlayTTSpacing,
} from "@/constants/playtt-tokens"
import {
  fetchCoachInsights,
  fetchCoachStatus,
  fetchCoachTraining,
} from "@/lib/coach-api"
import type { CoachInsight, CoachStatus, CoachTrainingItem } from "@/lib/coach-types"
import { fetchReplayCredits } from "@/lib/replay-credits-api"
import { useProductTheme } from "@/hooks/use-product-theme"

type CoachSegment = "insights" | "training"

function CoachScreenSkeleton() {
  const theme = useProductTheme()
  return (
    <View style={{ gap: PlayTTSpacing.lg, paddingTop: PlayTTSpacing.md }}>
      <View
        style={{
          height: 120,
          borderRadius: 28,
          backgroundColor: theme.elevated,
        }}
      />
      <View style={{ height: 36, borderRadius: 999, backgroundColor: theme.elevated }} />
      <View style={{ height: 80, backgroundColor: theme.elevated, borderRadius: 12 }} />
      <View style={{ height: 80, backgroundColor: theme.elevated, borderRadius: 12 }} />
    </View>
  )
}

export default function CoachScreen() {
  const theme = useProductTheme()
  const styles = useMemo(() => createAppScreenStyles(theme), [theme])
  const [segment, setSegment] = useState<CoachSegment>("insights")
  const [status, setStatus] = useState<CoachStatus | null>(null)
  const [insights, setInsights] = useState<CoachInsight[]>([])
  const [training, setTraining] = useState<CoachTrainingItem[]>([])
  const [clipBalance, setClipBalance] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [clipSheetOpen, setClipSheetOpen] = useState(false)
  const [subscribeSheetOpen, setSubscribeSheetOpen] = useState(false)

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

  useFocusEffect(
    useCallback(() => {
      void loadCoach()
    }, [loadCoach]),
  )

  const coachStatus = status ?? {
    isActive: false,
    planLabel: "Coach",
    monthlyPriceKes: 0,
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { gap: PlayTTSpacing.lg, paddingBottom: PlayTTSpacing["2xl"] },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => void loadCoach(true)}
            tintColor={theme.foreground}
          />
        }
      >
        <SkeletonGate loading={isLoading} skeleton={<CoachScreenSkeleton />}>
          {loadError ? (
            <View style={{ gap: PlayTTSpacing.md }}>
              <Text
                style={{
                  fontSize: 15,
                  fontFamily: PlayTTFontFamilies.regular,
                  color: theme.muted,
                  lineHeight: 22,
                }}
              >
                Could not load Coach. Pull to refresh or try again.
              </Text>
              <Button
                label="Try again"
                variant="outline"
                surface="product"
                productTheme={theme}
                onPress={() => void loadCoach()}
              />
            </View>
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

              <SegmentControl
                value={segment}
                options={[
                  { value: "insights", label: "Insights" },
                  { value: "training", label: "Training" },
                ]}
                onChange={setSegment}
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
    </SafeAreaView>
  )
}
