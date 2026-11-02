import { type Href, router, useFocusEffect, useLocalSearchParams } from "expo-router"
import { useCallback, useRef, useState } from "react"
import { ActivityIndicator, FlatList, StyleSheet, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"

import { CommunityScreenHeader } from "@/components/community/community-screen-header"
import { PlayerCard } from "@/components/community/player-card/player-card"
import { ChoiceChips } from "@/components/kit/choice-chips"
import { AppText } from "@/components/ui/app-text"
import { KitLayout } from "@/constants/kit-layout"
import { PlayTTSpacing } from "@/constants/playtt-tokens"
import { useAppTheme } from "@/hooks/use-app-theme"
import { fetchPlayerConnections } from "@/lib/community-api"
import { communityPlayerHref, type CommunityPlayer } from "@/lib/community-types"
import { toast } from "@/lib/toast"

type Kind = "followers" | "following"

const KINDS: { value: Kind; label: string }[] = [
  { value: "followers", label: "Followers" },
  { value: "following", label: "Following" },
]

export default function CommunityConnectionsScreen() {
  const params = useLocalSearchParams<{ userId: string; kind?: string; name?: string }>()
  const { colors } = useAppTheme()
  const [kind, setKind] = useState<Kind>(params.kind === "following" ? "following" : "followers")
  const [players, setPlayers] = useState<CommunityPlayer[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [loadedKind, setLoadedKind] = useState<Kind | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const requestId = useRef(0)

  const load = useCallback(async () => {
    const id = ++requestId.current
    try {
      const page = await fetchPlayerConnections(params.userId, kind)
      if (id === requestId.current) {
        setPlayers(page.players)
        setCursor(page.nextCursor)
      }
    } catch (error) {
      toast.apiError(error, "Could not load this list.")
    } finally {
      if (id === requestId.current) setLoadedKind(kind)
    }
  }, [kind, params.userId])

  useFocusEffect(
    useCallback(() => {
      void load()
    }, [load]),
  )

  const loading = loadedKind !== kind

  async function loadMore() {
    if (!cursor || loadingMore) return
    const id = requestId.current
    setLoadingMore(true)
    try {
      const page = await fetchPlayerConnections(params.userId, kind, cursor)
      if (id === requestId.current) {
        setPlayers((current) => [...current, ...page.players.filter((p) => !current.some((c) => c.id === p.id))])
        setCursor(page.nextCursor)
      }
    } catch (error) {
      toast.apiError(error, "Could not load more players.")
    } finally {
      setLoadingMore(false)
    }
  }

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]} edges={["top", "left", "right"]}>
      <CommunityScreenHeader title={params.name || "Connections"} />
      <View style={styles.segment}>
        <ChoiceChips label="Show" options={KINDS} value={kind} onChange={setKind} />
      </View>
      <FlatList
        data={loading ? [] : players}
        keyExtractor={(player) => player.id}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={[styles.separator, { backgroundColor: colors.separator }]} />}
        renderItem={({ item }) => (
          <PlayerCard
            player={item}
            size="mini"
            onPress={() =>
              router.push(communityPlayerHref(item.id) as Href)
            }
          />
        )}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator style={styles.loading} color={colors.secondaryLabel} />
          ) : (
            <AppText variant="body" color="secondaryLabel" style={styles.empty}>
              {kind === "followers" ? "No followers yet." : "Not following anyone yet."}
            </AppText>
          )
        }
        ListFooterComponent={loadingMore ? <ActivityIndicator color={colors.secondaryLabel} /> : undefined}
        onEndReached={() => void loadMore()}
        onEndReachedThreshold={0.4}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  segment: { paddingHorizontal: KitLayout.screenGutter, paddingBottom: PlayTTSpacing.sm },
  list: { paddingHorizontal: KitLayout.screenGutter, paddingBottom: PlayTTSpacing["2xl"] },
  separator: { height: StyleSheet.hairlineWidth },
  loading: { marginTop: PlayTTSpacing.xl },
  empty: { textAlign: "center", marginTop: PlayTTSpacing.xl },
})
