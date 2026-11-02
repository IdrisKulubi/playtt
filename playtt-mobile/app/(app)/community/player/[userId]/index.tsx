import { type Href, router, useFocusEffect, useLocalSearchParams } from "expo-router"
import { DotsThreeVertical } from "phosphor-react-native/src/icons/DotsThreeVertical"
import { useCallback, useState } from "react"
import { ActivityIndicator, Alert, ScrollView, StyleSheet, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"

import { CommunityScreenHeader } from "@/components/community/community-screen-header"
import { availabilitySummary } from "@/components/community/open-status-bar"
import { PlayerCard } from "@/components/community/player-card/player-card"
import { USUAL_TIME_LABELS, headToHeadLine, sharedUsualTimes } from "@/components/community/player-card/card-tiers"
import { ReportPlayerSheet } from "@/components/community/report-player-sheet"
import { Button } from "@/components/kit/button"
import { EmptyState } from "@/components/kit/empty-state"
import { PressableScale } from "@/components/kit/pressable-scale"
import { AppText } from "@/components/ui/app-text"
import { KitLayout } from "@/constants/kit-layout"
import { PlayTTSpacing } from "@/constants/playtt-tokens"
import { useAppTheme } from "@/hooks/use-app-theme"
import { isApiError } from "@/lib/api-error"
import {
  blockPlayer,
  fetchCommunityMe,
  fetchHeadToHead,
  joinDoubles,
  fetchCommunityPlayer,
  followPlayer,
  unfollowPlayer,
} from "@/lib/community-api"
import { startConversation } from "@/lib/community-chat-api"
import {
  communityChatHref,
  communityGroupHref,
  communityPlayerHref,
  type CommunityHeadToHead,
  type CommunityPlayerDetail,
  type UsualTimeKey,
} from "@/lib/community-types"
import { toast } from "@/lib/toast"

const PLAYERS_HREF = "/(app)/(tabs)/community" as Href

/** A player's profile: their card, whether they're free, and how to get a game going. */
export default function CommunityPlayerScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>()
  const { colors } = useAppTheme()
  const [player, setPlayer] = useState<CommunityPlayerDetail | null>(null)
  const [missing, setMissing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [starting, setStarting] = useState(false)
  const [myUsualTimes, setMyUsualTimes] = useState<UsualTimeKey[]>([])
  const [h2h, setH2h] = useState<CommunityHeadToHead | null>(null)
  const [joiningDoubles, setJoiningDoubles] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [reportKey, setReportKey] = useState(0)

  const load = useCallback(async () => {
    try {
      const [next, me, record] = await Promise.all([
        fetchCommunityPlayer(userId),
        fetchCommunityMe().catch(() => null),
        fetchHeadToHead(userId).catch(() => null),
      ])
      setPlayer(next)
      if (me) setMyUsualTimes(me.profile.usualTimes)
      setH2h(record)
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

  async function joinDoublesGroup() {
    if (!player) return
    setJoiningDoubles(true)
    try {
      const group = await joinDoubles(player.id)
      router.push(communityGroupHref(group.id) as Href)
    } catch (error) {
      toast.apiError(error, "Could not join this doubles game.")
    } finally {
      setJoiningDoubles(false)
    }
  }

  async function letsPlay() {
    if (!player) return
    setStarting(true)
    try {
      const conversation = await startConversation(player.id)
      router.push(communityChatHref(conversation.id) as Href)
    } catch (error) {
      toast.apiError(error, "Could not open a chat.")
    } finally {
      setStarting(false)
    }
  }

  function confirmBlock() {
    if (!player) return
    Alert.alert(
      `Block ${player.displayName}?`,
      "You won't see each other in Players, and any follows between you are removed.",
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

  const menu = player ? (
    <PressableScale
      accessibilityLabel={`More options for ${player.displayName}`}
      accessibilityHint="Report or block"
      onPress={openMenu}
      style={[styles.menuButton, { backgroundColor: colors.surface }]}
    >
      <DotsThreeVertical size={18} color={colors.accentText} weight="bold" />
      <AppText variant="subheadline" weight="600">
        More
      </AppText>
    </PressableScale>
  ) : null

  const canMessage = player?.relationship.canMessage ?? false
  const match = player ? matchHint(myUsualTimes, player.usualTimes) : null
  const record = player ? headToHeadLine(h2h, player.displayName) : null

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]} edges={["top", "left", "right"]}>
      <CommunityScreenHeader title={player?.displayName ?? "Player"} trailing={menu} />

      {missing ? (
        <EmptyState
          icon="person.fill"
          title="This player isn't available"
          message="Their card is hidden or they've left Players."
          action={{ label: "Back to Players", onPress: () => router.navigate(PLAYERS_HREF) }}
        />
      ) : !player ? (
        <ActivityIndicator style={styles.loading} color={colors.secondaryLabel} />
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.cardWrap}>
            <PlayerCard player={{ ...player, headToHead: h2h }} size="full" flippable />
          </View>

          {player.availability ? (
            <AppText variant="headline" color="success" style={styles.center}>
              {availabilitySummary(player.availability, "player")}
              {player.availability.note ? ` · "${player.availability.note}"` : ""}
            </AppText>
          ) : null}

          <View style={styles.counts}>
            {(["followers", "following"] as const).map((kind) => (
              <PressableScale
                key={kind}
                onPress={() => openConnections(kind)}
                accessibilityLabel={`${player.counts[kind]} ${kind === "followers" ? "followers" : "following"}. Show list`}
                style={[styles.count, { backgroundColor: colors.surface }]}
              >
                <AppText variant="title2" tabular>
                  {player.counts[kind]}
                </AppText>
                <AppText variant="footnote" color="secondaryLabel">
                  {kind === "followers" ? "Followers" : "Following"}
                </AppText>
              </PressableScale>
            ))}
          </View>

          {match || player.relationship.followsYou || record ? (
            <View style={styles.facts}>
              {player.relationship.followsYou ? (
                <AppText variant="callout" weight="600" color="secondaryLabel" style={styles.center}>
                  {player.relationship.rallyPartner ? "Rally partner · you follow each other" : "Follows you"}
                </AppText>
              ) : null}
              {match ? (
                <AppText variant="callout" weight="600" color="accentText" style={styles.center}>
                  {match}
                </AppText>
              ) : null}
              {record ? (
                <AppText variant="callout" weight="600" color="accentText" style={styles.center}>
                  {record}
                </AppText>
              ) : null}
            </View>
          ) : null}

          {/* One cyan button: "Let's play" when you can message, otherwise the next best step. */}
          {canMessage ? (
            <Button label="Let's play" loading={starting} disabled={starting} onPress={letsPlay} />
          ) : null}
          {player.availability?.lookingForDoubles ? (
            <Button
              label={doublesFull(player) ? "Doubles game is full" : "Join their doubles game"}
              variant={canMessage ? "secondary" : "primary"}
              loading={joiningDoubles}
              disabled={joiningDoubles || doublesFull(player)}
              onPress={joinDoublesGroup}
            />
          ) : null}
          <Button
            label={player.relationship.following ? "Following" : "Follow"}
            variant={
              player.relationship.following || canMessage || player.availability?.lookingForDoubles
                ? "secondary"
                : "primary"
            }
            accessibilityHint={player.relationship.following ? "Tap to unfollow" : undefined}
            loading={busy}
            disabled={busy}
            onPress={toggleFollow}
          />
          <AppText variant="callout" color="secondaryLabel" style={styles.center}>
            {canMessage
              ? "Agree a time in chat, then book a table as usual."
              : player.relationship.following
                ? `${player.displayName} only takes messages from rally partners (players who follow each other).`
                : `Follow ${player.displayName} to message them.`}
          </AppText>
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

/** "Also free on weekday evenings" when both players usually play then. */
function matchHint(mine: UsualTimeKey[], theirs: UsualTimeKey[]) {
  const shared = sharedUsualTimes(mine, theirs).map((key) => USUAL_TIME_LABELS[key].toLowerCase())
  if (shared.length === 0) return null
  const list = shared.length > 1 ? `${shared.slice(0, -1).join(", ")} and ${shared.at(-1)}` : shared[0]
  return `You both usually play ${list}`
}

function doublesFull(player: CommunityPlayerDetail) {
  const fill = player.availability?.doubles
  return Boolean(fill && fill.members >= fill.max)
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: KitLayout.screenGutter, paddingBottom: PlayTTSpacing["2xl"], gap: PlayTTSpacing.md },
  cardWrap: { paddingHorizontal: PlayTTSpacing.md },
  center: { textAlign: "center" },
  counts: { flexDirection: "row", gap: PlayTTSpacing.sm },
  count: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: PlayTTSpacing.sm,
    borderRadius: KitLayout.groupRadius,
  },
  facts: { gap: PlayTTSpacing["2xs"] },
  loading: { marginTop: PlayTTSpacing.xl },
  menuButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: PlayTTSpacing["2xs"],
    paddingHorizontal: PlayTTSpacing.md,
    borderRadius: 24,
  },
})
