import { useMemo, useState } from "react"
import { ScrollView, StyleSheet, Text, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"

import { CommunityHeader } from "@/components/community/community-header"
import { CommunityPlayerRow } from "@/components/community/community-player-row"
import { OpenRequestsSection } from "@/components/community/open-requests-section"
import { RequestMatchSheet } from "@/components/community/request-match-sheet"
import { createAppScreenStyles } from "@/components/layout/app-screen-styles"
import { Button } from "@/components/ui/button"
import { FLOATING_TAB_BAR_CLEARANCE } from "@/constants/navigation-layout"
import { PlayTTFontFamilies, PlayTTSpacing } from "@/constants/playtt-tokens"
import { useProductTheme } from "@/hooks/use-product-theme"
import {
  MOCK_COMMUNITY_PLAYERS,
  MOCK_OPEN_REQUESTS,
  type CommunityPlayer,
} from "@/lib/mock/mock-community"

export default function CommunityScreen() {
  const theme = useProductTheme()
  const styles = useMemo(() => createAppScreenStyles(theme), [theme])
  const [selectedPlayer, setSelectedPlayer] = useState<CommunityPlayer | null>(
    null,
  )
  const [sheetOpen, setSheetOpen] = useState(false)

  const sectionStyles = useMemo(
    () =>
      StyleSheet.create({
        label: {
          fontSize: 13,
          fontFamily: PlayTTFontFamilies.semiBold,
          color: theme.muted,
          textTransform: "uppercase",
          letterSpacing: 0.5,
          marginBottom: PlayTTSpacing.xs,
        },
      }),
    [theme],
  )

  function openCreateRequest() {
    setSelectedPlayer(null)
    setSheetOpen(true)
  }

  function openPlayerRequest(player: CommunityPlayer) {
    setSelectedPlayer(player)
    setSheetOpen(true)
  }

  function closeSheet() {
    setSheetOpen(false)
    setSelectedPlayer(null)
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          {
            gap: PlayTTSpacing.lg,
            paddingBottom: FLOATING_TAB_BAR_CLEARANCE,
          },
        ]}
      >
        <CommunityHeader />

        <Button
          label="Request a match"
          surface="product"
          productTheme={theme}
          onPress={openCreateRequest}
        />

        <View>
          <Text style={sectionStyles.label}>Nearby players</Text>
          {MOCK_COMMUNITY_PLAYERS.map((player, index) => (
            <CommunityPlayerRow
              key={player.id}
              player={player}
              onPress={() => openPlayerRequest(player)}
              isLast={index === MOCK_COMMUNITY_PLAYERS.length - 1}
            />
          ))}
        </View>

        <OpenRequestsSection requests={MOCK_OPEN_REQUESTS} />
      </ScrollView>

      <RequestMatchSheet
        visible={sheetOpen}
        player={selectedPlayer}
        onClose={closeSheet}
      />
    </SafeAreaView>
  )
}
