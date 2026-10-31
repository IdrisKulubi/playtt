import { type Href, router, useFocusEffect, useLocalSearchParams } from "expo-router"
import { DotsThreeVertical } from "phosphor-react-native/src/icons/DotsThreeVertical"
import { useCallback, useMemo, useState } from "react"
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"

import { CommunityScreenHeader } from "@/components/community/community-screen-header"
import { availabilitySummary } from "@/components/community/open-status-bar"
import { PlayerCard } from "@/components/community/player-card/player-card"
import { ReportPlayerSheet } from "@/components/community/report-player-sheet"
import { createAppScreenStyles } from "@/components/layout/app-screen-styles"
import { Button } from "@/components/ui/button"
import { PlayTTFontFamilies, PlayTTSpacing } from "@/constants/playtt-tokens"
import { useProductTheme } from "@/hooks/use-product-theme"
import { isApiError } from "@/lib/api-error"
import { blockPlayer, fetchCommunityPlayer, followPlayer, unfollowPlayer } from "@/lib/community-api"
import { communityPlayerHref, type CommunityPlayerDetail } from "@/lib/community-types"
import { toast } from "@/lib/toast"

export default function CommunityPlayerScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>()
  const theme = useProductTheme()
  const screenStyles = useMemo(() => createAppScreenStyles(theme), [theme])
  const [player, setPlayer] = useState<CommunityPlayerDetail | null>(null)
  const [missing, setMissing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [reportKey, setReportKey] = useState(0)

  const load = useCallback(async () => {
    try {
      setPlayer(await fetchCommunityPlayer(userId))
      setMissing(false)
    } catch (error) {
      if (isApiError(error) && error.status === 404) {
        setMissing(true)
      } else {
        toast.apiError(error, "Could not load this player.")
      }
    }
  }, [userId])

  // Refetch on focus so follow counts are fresh after visiting a connections list.
  useFocusEffect(
    useCallback(() => {
      void load()
    }, [load]),
  )

  async function toggleFollow() {
    if (!player) return
    setBusy(true)
    try {
      if (player.relationship.following) {
        await unfollowPlayer(player.id)
        await load()
      } else {
        setPlayer(await followPlayer(player.id))
      }
    } catch (error) {
      toast.apiError(error, "Could not update follow.")
    } finally {
      setBusy(false)
    }
  }

  function confirmBlock() {
    if (!player) return
    Alert.alert(
      `Block ${player.displayName}?`,
      "You won't see each other in Community, and any follows between you are removed.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Block",
          style: "destructive",
          onPress: async () => {
            try {
              await blockPlayer(player.id)
              toast.success(`${player.displayName} is blocked.`)
              router.back()
            } catch (error) {
              toast.apiError(error, "Could not block this player.")
            }
          },
        },
      ],
    )
  }

  function openMenu() {
    Alert.alert(player?.displayName ?? "Player", undefined, [
      {
        text: "Report",
        onPress: () => {
          setReportKey((value) => value + 1)
          setReportOpen(true)
        },
      },
      { text: "Block", style: "destructive", onPress: confirmBlock },
      { text: "Cancel", style: "cancel" },
    ])
  }

  function openConnections(kind: "followers" | "following") {
    const query = new URLSearchParams({ kind, name: player?.displayName ?? "" })
    router.push(`${communityPlayerHref(userId)}/connections?${query.toString()}` as Href)
  }

  const styles = useMemo(
    () =>
      StyleSheet.create({
        scroll: { paddingHorizontal: 20, paddingBottom: PlayTTSpacing["2xl"], gap: PlayTTSpacing.md },
        cardWrap: { paddingHorizontal: PlayTTSpacing.md },
        statusLine: { fontFamily: PlayTTFontFamilies.medium, fontSize: 14, color: theme.muted, textAlign: "center" },
        counts: { flexDirection: "row", justifyContent: "center", gap: PlayTTSpacing.xl },
        count: { alignItems: "center" },
        countValue: { fontFamily: PlayTTFontFamilies.bold, fontSize: 20, color: theme.foreground },
        countLabel: { fontFamily: PlayTTFontFamilies.regular, fontSize: 13, color: theme.muted },
        followsYou: { fontFamily: PlayTTFontFamilies.medium, fontSize: 13, color: theme.muted, textAlign: "center" },
        hint: { fontFamily: PlayTTFontFamilies.regular, fontSize: 13, color: theme.muted, textAlign: "center", lineHeight: 18 },
        missing: { flex: 1, alignItems: "center", justifyContent: "center", gap: PlayTTSpacing.sm, padding: PlayTTSpacing.lg },
        missingTitle: { fontFamily: PlayTTFontFamilies.semiBold, fontSize: 18, color: theme.foreground },
        menuButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
      }),
    [theme],
  )

  const menu = player ? (
    <Pressable accessibilityRole="button" accessibilityLabel="More options" hitSlop={6} onPress={openMenu} style={styles.menuButton}>
      <DotsThreeVertical size={22} color={theme.foreground} weight="bold" />
    </Pressable>
  ) : null

  return (
    <SafeAreaView style={screenStyles.safeArea} edges={["top", "left", "right"]}>
      <CommunityScreenHeader title={player?.displayName ?? "Player"} trailing={menu} />

      {missing ? (
        <View style={styles.missing}>
          <Text style={styles.missingTitle}>Player not available</Text>
          <Text style={styles.hint}>This card is hidden or no longer in Community.</Text>
        </View>
      ) : !player ? (
        <ActivityIndicator style={{ marginTop: PlayTTSpacing.xl }} color={theme.muted} />
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.cardWrap}>
            <PlayerCard player={player} size="full" flippable />
          </View>

          {player.availability ? (
            <Text style={styles.statusLine}>
              {availabilitySummary(player.availability, "player")}
              {player.availability.note ? ` · "${player.availability.note}"` : ""}
            </Text>
          ) : null}

          <View style={styles.counts}>
            <Pressable accessibilityRole="button" onPress={() => openConnections("followers")} style={styles.count}>
              <Text style={styles.countValue}>{player.counts.followers}</Text>
              <Text style={styles.countLabel}>Followers</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => openConnections("following")} style={styles.count}>
              <Text style={styles.countValue}>{player.counts.following}</Text>
              <Text style={styles.countLabel}>Following</Text>
            </Pressable>
          </View>

          {player.relationship.followsYou ? (
            <Text style={styles.followsYou}>
              {player.relationship.rallyPartner ? "Rally partner · you follow each other" : "Follows you"}
            </Text>
          ) : null}

          <Button
            label={player.relationship.following ? "Following" : "Follow"}
            variant={player.relationship.following ? "outline" : "primary"}
            surface="product"
            productTheme={theme}
            loading={busy}
            disabled={busy}
            onPress={toggleFollow}
          />
          <Text style={styles.hint}>Chat with players to agree a time. Coming in the next update.</Text>
        </ScrollView>
      )}

      {player ? (
        <ReportPlayerSheet
          key={reportKey}
          visible={reportOpen}
          targetUserId={player.id}
          displayName={player.displayName}
          onClose={() => setReportOpen(false)}
        />
      ) : null}
    </SafeAreaView>
  )
}
