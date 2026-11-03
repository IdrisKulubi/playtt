import { type Href, router, useFocusEffect } from "expo-router"
import { useCallback, useState } from "react"
import { RefreshControl, StyleSheet, View } from "react-native"

import { ProfileButton } from "@/components/account/profile-button"
import { LatestHighlights } from "@/components/activity/latest-highlights"
import { ProgressStatsCard } from "@/components/activity/progress-stats-card"
import { ClipPackPurchaseSheet } from "@/components/coach/clip-pack-purchase-sheet"
import { Button } from "@/components/kit/button"
import { Card } from "@/components/kit/card"
import { ListRow } from "@/components/kit/list-row"
import { ListSection } from "@/components/kit/list-section"
import { Screen } from "@/components/kit/screen"
import { AppText } from "@/components/ui/app-text"
import { IconSymbol } from "@/components/ui/icon-symbol"
import { PlayTTSpacing } from "@/constants/playtt-tokens"
import { useAppTheme } from "@/hooks/use-app-theme"
import { fetchActivityReplayCredits } from "@/lib/replay-credits-api"

const REPLAYS_HREF = "/(app)/progress/replays"
const STATS_HREF = "/(app)/progress/stats" as Href
const COACH_HREF = "/(app)/coach" as Href
const BOOK_HREF = "/(app)/book" as Href

function creditsSentence(balance: number) {
  if (balance === 0) return "You have no replays left"
  return balance === 1 ? "You have 1 replay left" : `You have ${balance} replays left`
}

/** Progress tab — job: show how I'm playing and how to get better. */
export default function ProgressScreen() {
  const { colors } = useAppTheme()
  const [clipBalance, setClipBalance] = useState<number | null>(null)
  const [clipSheetOpen, setClipSheetOpen] = useState(false)
  // Bumping this remounts the stats card and highlights so pull-to-refresh reloads them.
  const [refreshKey, setRefreshKey] = useState(0)

  const loadCredits = useCallback(() => {
    void fetchActivityReplayCredits()
      .then((credits) => setClipBalance(credits.balance))
      .catch(() => setClipBalance(null))
  }, [])

  useFocusEffect(
    useCallback(() => {
      loadCredits()
    }, [loadCredits]),
  )

  return (
    <Screen
      title="Progress"
      inTabs
      cornerAccessory={<ProfileButton />}
      refreshControl={
        <RefreshControl
          refreshing={false}
          onRefresh={() => {
            setRefreshKey((value) => value + 1)
            loadCredits()
          }}
          tintColor={colors.secondaryLabel}
        />
      }
    >
      <View style={styles.section} key={`stats-${refreshKey}`}>
        <ProgressStatsCard />
        <Button label="See detailed stats" variant="plain" onPress={() => router.push(STATS_HREF)} />
      </View>

      <View style={styles.section}>
        <AppText variant="title2" accessibilityRole="header">
          Latest highlights
        </AppText>
        <LatestHighlights
          key={`highlights-${refreshKey}`}
          onOpen={(replay) =>
            router.push({ pathname: REPLAYS_HREF, params: { replayId: replay.id } } as unknown as Href)
          }
          empty={
            <Card>
              <AppText variant="body" color="secondaryLabel">
                Replays of your games show up here a few minutes after you play.
              </AppText>
              <Button label="Book a table" variant="secondary" onPress={() => router.push(BOOK_HREF)} style={styles.cardButton} />
            </Card>
          }
        />
      </View>

      <Card>
        <View style={styles.coach}>
          <View style={[styles.coachIcon, { backgroundColor: colors.fill }]}>
            <IconSymbol name="sparkles" size={24} color={colors.accentText} />
          </View>
          <AppText variant="title3" accessibilityRole="header">
            Coach
          </AppText>
          <AppText variant="body" color="secondaryLabel">
            Tips and training plans built from your games and replays.
          </AppText>
          <Button label="Open Coach" onPress={() => router.push(COACH_HREF)} style={styles.cardButton} />
        </View>
      </Card>

      <ListSection header="Replays">
        <ListRow
          icon="film.stack"
          title="All replays"
          subtitle={clipBalance === null ? undefined : creditsSentence(clipBalance)}
          onPress={() => router.push(REPLAYS_HREF as Href)}
        />
        <ListRow
          icon="cart.fill"
          tone="success"
          title="Get more replays"
          subtitle="Buy a pack of replay credits"
          onPress={() => setClipSheetOpen(true)}
        />
      </ListSection>

      <ClipPackPurchaseSheet
        visible={clipSheetOpen}
        onClose={() => setClipSheetOpen(false)}
        onPurchased={loadCredits}
      />
    </Screen>
  )
}

const styles = StyleSheet.create({
  section: { gap: PlayTTSpacing.sm },
  coach: { gap: PlayTTSpacing.xs },
  coachIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  cardButton: { marginTop: PlayTTSpacing.sm },
})
