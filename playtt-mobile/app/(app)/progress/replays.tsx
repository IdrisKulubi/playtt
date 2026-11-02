import { router, useLocalSearchParams, type Href } from "expo-router"
import { useCallback, useState } from "react"
import { StyleSheet, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { ReplayLibrary } from "@/components/activity/replay-library"
import {
  REPLAY_SHARE_DOCK_HEIGHT,
  ReplayShareDock,
} from "@/components/activity/replay-share-bar"
import { Screen } from "@/components/kit/screen"
import { PlayTTSpacing } from "@/constants/playtt-tokens"
import { USE_LIVE_ACTIVITY_CLIPS } from "@/lib/mock/mock-config"
import type { ReplaySummary } from "@/lib/replay-types"

const PROGRESS_HREF = "/(app)/(tabs)/activity" as Href

/** Every replay, opened from Progress. Selecting one shows the share bar. */
export default function ReplaysScreen() {
  const insets = useSafeAreaInsets()
  const { replayId } = useLocalSearchParams<{ replayId?: string }>()
  const [dockReplay, setDockReplay] = useState<ReplaySummary | null>(null)
  const showDock = dockReplay !== null && USE_LIVE_ACTIVITY_CLIPS

  const back = useCallback(() => {
    if (router.canGoBack()) router.back()
    else router.replace(PROGRESS_HREF)
  }, [])

  return (
    <View style={styles.root}>
      <Screen
        title="Replays"
        back={{ label: "Progress", onPress: back }}
        contentContainerStyle={
          showDock
            ? { paddingBottom: insets.bottom + REPLAY_SHARE_DOCK_HEIGHT + PlayTTSpacing.xl }
            : undefined
        }
      >
        <ReplayLibrary initialReplayId={replayId} onSelectedReplayChange={setDockReplay} />
      </Screen>

      {showDock && dockReplay ? <ReplayShareDock replay={dockReplay} bottomInset={insets.bottom} /> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
})
