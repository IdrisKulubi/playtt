import { useMemo, useState } from "react"
import { StyleSheet, Text, View } from "react-native"

import { FeaturedReplay } from "@/components/activity/featured-replay"
import { ReplayDetailSheet } from "@/components/activity/replay-detail-sheet"
import { ReplayListRow } from "@/components/activity/replay-list-row"
import {
  PlayTTFontFamilies,
  PlayTTSpacing,
} from "@/constants/playtt-tokens"
import { useProductTheme } from "@/hooks/use-product-theme"
import { MOCK_REPLAYS, type MockReplay } from "@/lib/mock/mock-replays"

export function ReplayLibrary() {
  const theme = useProductTheme()
  const [selectedReplay, setSelectedReplay] = useState<MockReplay | null>(null)

  const featured = MOCK_REPLAYS[0]
  const moreReplays = MOCK_REPLAYS.slice(1)

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: {
          gap: PlayTTSpacing.lg,
        },
        sectionLabel: {
          fontSize: 13,
          fontFamily: PlayTTFontFamilies.semiBold,
          color: theme.muted,
          textTransform: "uppercase",
          letterSpacing: 0.5,
        },
      }),
    [theme],
  )

  if (!featured) {
    return null
  }

  return (
    <View style={styles.root}>
      <FeaturedReplay
        replay={featured}
        onPress={() => setSelectedReplay(featured)}
      />

      {moreReplays.length > 0 ? (
        <View>
          <Text style={styles.sectionLabel}>Earlier clips</Text>
          {moreReplays.map((replay, index) => (
            <ReplayListRow
              key={replay.id}
              replay={replay}
              onPress={() => setSelectedReplay(replay)}
              isLast={index === moreReplays.length - 1}
            />
          ))}
        </View>
      ) : null}

      <ReplayDetailSheet
        replay={selectedReplay}
        visible={selectedReplay !== null}
        onClose={() => setSelectedReplay(null)}
      />
    </View>
  )
}
