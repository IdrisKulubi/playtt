import { type Href, router, useFocusEffect } from "expo-router"
import { useCallback, useMemo, useState } from "react"
import { useMinimizeOnScroll } from "expo-glass-tabs"
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, View } from "react-native"
import Animated, { FadeInDown, useComposedEventHandler, useReducedMotion } from "react-native-reanimated"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { ChoiceChips } from "@/components/kit/choice-chips"
import { AtVenueStrip } from "@/components/community/at-venue-strip"
import { EventsSection } from "@/components/community/events-section"
import { InviteCodeSheet } from "@/components/community/invite-code-sheet"
import { CommunityFilterChips } from "@/components/community/community-filter-chips"
import { ProfileButton } from "@/components/account/profile-button"
import { CommunityHeader } from "@/components/community/community-header"
import { HeaderBar, useCollapsingHeader } from "@/components/kit/collapsing-header"
import { CommunityIntro } from "@/components/community/community-intro"
import { ConfettiBurst } from "@/components/community/confetti-burst"
import { OpenStatusBar } from "@/components/community/open-status-bar"
import { OpenToPlaySheet } from "@/components/community/open-to-play-sheet"
import { PlayerCard } from "@/components/community/player-card/player-card"
import { RallyPartnersRow } from "@/components/community/rally-partners-row"
import { Button } from "@/components/kit/button"
import { Card } from "@/components/kit/card"
import { EmptyState } from "@/components/kit/empty-state"
import { AppText } from "@/components/ui/app-text"
import { Skeleton } from "@/components/ui/skeleton"
import { KitLayout } from "@/constants/kit-layout"
import { getFloatingTabBarInset } from "@/constants/navigation-layout"
import { PlayTTSpacing } from "@/constants/playtt-tokens"
import { useAppTheme } from "@/hooks/use-app-theme"
import { useCommunityUnread } from "@/hooks/use-community-unread"
import {
  communityFilters,
  useCommunityMe,
  useCommunitySocial,
  useCommunityPlayers,
  type CommunitySegment as Segment,
} from "@/hooks/use-community"
import { useSkeletonSurface } from "@/hooks/use-product-theme"
import { acceptInvite, joinEvent, stopOpenToPlay } from "@/lib/community-api"
import { shareInvite, takePendingInvite } from "@/lib/community-invite"
import { startConversation } from "@/lib/community-chat-api"
import {
  communityChatHref,
  communityGroupHref,
  communityPlayerHref,
  type CommunityEvent,
  type CommunityPlayer,
  type CommunitySkillLevel,
  type UsualTimeKey,
} from "@/lib/community-types"
import { toast } from "@/lib/toast"

type ListSegment = Exclude<Segment, "open">

const LIST_SEGMENTS: { value: ListSegment; label: string }[] = [
  { value: "everyone", label: "Everyone" },
  { value: "following", label: "Following" },
]

// The "Open to play now" row always shows everyone open, whatever the list filters say.
const OPEN_NOW_FILTERS = communityFilters("open", null, false)
const OPEN_CARD_WIDTH = 168

const EMPTY_COPY: Record<ListSegment, { title: string; detail: string }> = {
  everyone: {
    title: "No players here yet",
    detail: "Invite your playing partners to create their cards.",
  },
  following: {
    title: "You're not following anyone yet",
    detail: "Follow players from their card to keep them here.",
  },
}

const PROFILE_EDITOR = "/(app)/account/community-profile"

function subtitleFor(venueName?: string | null) {
  return venueName ? `Find someone to play with at ${venueName}.` : "Find someone to play with at your venue."
}

/** Players tab — job: find someone to play with. */
export default function CommunityScreen() {
  const { colors } = useAppTheme()
  const insets = useSafeAreaInsets()
  const skeletonSurface = useSkeletonSurface()
  const reduceMotion = useReducedMotion()
  const collapsing = useCollapsingHeader()
  const minimizeTabBar = useMinimizeOnScroll()
  const onScroll = useComposedEventHandler([collapsing.trackScroll, minimizeTabBar])
  const [segment, setSegment] = useState<ListSegment>("everyone")
  const [skill, setSkill] = useState<CommunitySkillLevel | null>(null)
  const [doubles, setDoubles] = useState(false)
  const [usualTime, setUsualTime] = useState<UsualTimeKey | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [sheetKey, setSheetKey] = useState(0)
  const [burst, setBurst] = useState(0)
  const [refreshing, setRefreshing] = useState(false)

  const { me, setMe, loading: meLoading, error: meError, reload: reloadMe } = useCommunityMe()
  const hasCard = Boolean(me?.profile.communityVisible)
  const filters = useMemo(
    () => communityFilters(segment, skill, doubles, usualTime),
    [segment, skill, doubles, usualTime],
  )
  const list = useCommunityPlayers(filters, hasCard)
  const openNow = useCommunityPlayers(OPEN_NOW_FILTERS, hasCard)
  const { unread } = useCommunityUnread(hasCard)
  const social = useCommunitySocial(hasCard)
  const [codeSheet, setCodeSheet] = useState<number | null>(null)

  async function redeemInvite(code: string) {
    try {
      const result = await acceptInvite(code)
      setCodeSheet(null)
      toast.success("You're connected. Say hi! 🏓")
      router.push(communityChatHref(result.conversationId) as Href)
    } catch (error) {
      toast.apiError(error, "Could not use that invite code.")
    }
  }

  // An invite link opened before sign-in is accepted here (survives sign-up).
  useFocusEffect(
    useCallback(() => {
      void takePendingInvite()
        .then((code) => (code ? redeemInvite(code) : undefined))
        .catch(() => undefined)
    }, []),
  )

  async function invite() {
    try {
      await shareInvite()
    } catch (error) {
      toast.apiError(error, "Could not create an invite.")
    }
  }

  async function joinCommunityEvent(event: CommunityEvent) {
    try {
      const group = await joinEvent(event.id)
      void social.reload()
      router.push(communityGroupHref(group.id) as Href)
    } catch (error) {
      toast.apiError(error, "Could not join this event.")
    }
  }

  function openSheet() {
    setSheetKey((value) => value + 1)
    setSheetOpen(true)
  }

  async function stopOpen() {
    try {
      setMe(await stopOpenToPlay())
      void list.reload()
      void openNow.reload()
    } catch (error) {
      toast.apiError(error, "Could not update your status.")
    }
  }

  async function refresh() {
    setRefreshing(true)
    await Promise.all([reloadMe(), list.reload(), openNow.reload(), social.reload()])
    setRefreshing(false)
  }

  async function letsPlay(player: CommunityPlayer) {
    try {
      const conversation = await startConversation(player.id)
      router.push(communityChatHref(conversation.id) as Href)
    } catch (error) {
      toast.apiError(error, "Could not open a chat.")
    }
  }

  function openPlayer(player: CommunityPlayer) {
    router.push(communityPlayerHref(player.id) as Href)
  }

  const header = (
    <View style={styles.header}>
      <CommunityHeader
        scrollY={collapsing.scrollY}
        titleHeight={collapsing.titleHeight}
        onTitleLayout={collapsing.onTitleLayout}
        venueName={me?.homeVenue?.name ?? list.venue?.name}
        onEditCard={hasCard ? () => router.push(PROFILE_EDITOR) : undefined}
        onOpenInbox={hasCard ? () => router.push("/community/inbox" as Href) : undefined}
        onInvite={hasCard ? () => void invite() : undefined}
        unreadCount={unread.inbox + (unread.groups ?? 0)}
        requestCount={unread.requests}
      />

      {hasCard && me ? (
        <>
          {/* Your own status first: a clear card you can change or stop. */}
          {me.availability ? (
            <OpenStatusBar availability={me.availability} onChange={openSheet} onStop={stopOpen} />
          ) : (
            <Card>
              <View style={styles.statusCard}>
                <AppText variant="title3">Want a game?</AppText>
                <AppText variant="body" color="secondaryLabel">
                  Let players here know you&apos;re free, and they can invite you to play.
                </AppText>
                <Button label="I'm open to play" onPress={openSheet} style={styles.statusButton} />
              </View>
            </Card>
          )}

          <View style={styles.section}>
            <AppText variant="title2" accessibilityRole="header">
              Open to play now
            </AppText>
            {openNow.loading && openNow.players.length === 0 ? (
              <ActivityIndicator color={colors.secondaryLabel} />
            ) : openNow.players.length === 0 ? (
              <AppText variant="body" color="secondaryLabel">
                No one is open right now. Be the first: tap &quot;I&apos;m open to play&quot;.
              </AppText>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.bleed}
                contentContainerStyle={styles.openRow}
              >
                {openNow.players.map((player) => (
                  <View key={player.id} style={styles.openCard}>
                    <PlayerCard player={player} size="compact" onPress={() => openPlayer(player)} />
                  </View>
                ))}
              </ScrollView>
            )}
          </View>

          <RallyPartnersRow players={social.rallyPartners} onOpenPlayer={openPlayer} onLetsPlay={letsPlay} />
          <AtVenueStrip atVenue={social.atVenue} onOpenPlayer={openPlayer} />
          <EventsSection
            events={social.events}
            onJoin={(event) => void joinCommunityEvent(event)}
            onOpen={(event) => router.push(communityGroupHref(event.id) as Href)}
          />

          <View style={styles.section}>
            <AppText variant="title2" accessibilityRole="header">
              Everyone at this venue
            </AppText>
            <ChoiceChips label="Show" options={LIST_SEGMENTS} value={segment} onChange={setSegment} />
            <CommunityFilterChips
              skill={skill}
              doubles={doubles}
              usualTime={usualTime}
              onSkillChange={setSkill}
              onDoublesChange={setDoubles}
              onUsualTimeChange={setUsualTime}
            />
          </View>
        </>
      ) : null}
    </View>
  )

  function renderBody() {
    if (meLoading && !me) {
      return (
        <View style={styles.skeletonGroup}>
          {[0, 1].map((row) => (
            <View key={row} style={styles.skeletonRow}>
              <Skeleton surface={skeletonSurface} height={220} borderRadius={18} style={styles.cell} />
              <Skeleton surface={skeletonSurface} height={220} borderRadius={18} style={styles.cell} />
            </View>
          ))}
        </View>
      )
    }

    if (!me) {
      return (
        <EmptyState
          icon="exclamationmark.triangle.fill"
          title="Players couldn't load"
          message={meError ? "Check your connection, then try again." : "Please try again."}
          action={{ label: "Try again", onPress: () => void reloadMe() }}
        />
      )
    }

    return (
      <CommunityIntro
        onCreate={() => router.push({ pathname: PROFILE_EDITOR, params: { setup: "1" } })}
        onEnterCode={() => setCodeSheet(Date.now())}
      />
    )
  }

  const showGrid = hasCard && me

  return (
    <View style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <Animated.FlatList
        onScroll={onScroll}
        scrollEventThrottle={16}
        data={showGrid ? list.players : []}
        keyExtractor={(player) => player.id}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top, paddingBottom: getFloatingTabBarInset(insets.bottom) + PlayTTSpacing.lg },
        ]}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <>
            {header}
            {showGrid ? null : renderBody()}
          </>
        }
        renderItem={({ item, index }) => (
          <Animated.View
            style={styles.cell}
            entering={reduceMotion ? undefined : FadeInDown.delay(Math.min(index, 12) * 40).duration(260)}
          >
            <PlayerCard player={item} size="compact" onPress={() => openPlayer(item)} />
          </Animated.View>
        )}
        ListEmptyComponent={
          showGrid ? (
            list.loading ? (
              <ActivityIndicator style={styles.loading} color={colors.secondaryLabel} />
            ) : (
              <View style={styles.empty}>
                <AppText variant="headline" style={styles.center}>
                  {EMPTY_COPY[segment].title}
                </AppText>
                <AppText variant="callout" color="secondaryLabel" style={styles.center}>
                  {EMPTY_COPY[segment].detail}
                </AppText>
              </View>
            )
          ) : undefined
        }
        ListFooterComponent={list.loadingMore ? <ActivityIndicator color={colors.secondaryLabel} /> : undefined}
        onEndReached={() => void list.loadMore()}
        onEndReachedThreshold={0.4}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.secondaryLabel} />}
      />

      <HeaderBar
        title="Players"
        subtitle={subtitleFor(me?.homeVenue?.name ?? list.venue?.name)}
        scrollY={collapsing.scrollY}
        titleHeight={collapsing.titleHeight}
        cornerAccessory={<ProfileButton />}
      />

      {me ? (
        <OpenToPlaySheet
          key={sheetKey}
          visible={sheetOpen}
          me={me}
          onClose={() => setSheetOpen(false)}
          onChanged={(next, wentOpen) => {
            setMe(next)
            if (wentOpen) setBurst((value) => value + 1)
            void list.reload()
            void openNow.reload()
          }}
        />
      ) : null}

      <ConfettiBurst burstKey={burst} />

      {codeSheet !== null ? (
        <InviteCodeSheet key={codeSheet} visible onClose={() => setCodeSheet(null)} onSubmit={redeemInvite} />
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: {
    paddingHorizontal: KitLayout.screenGutter,
    gap: PlayTTSpacing.sm,
  },
  header: { gap: PlayTTSpacing.lg, marginBottom: PlayTTSpacing.sm },
  section: { gap: PlayTTSpacing.sm },
  statusCard: { gap: PlayTTSpacing.xs },
  statusButton: { marginTop: PlayTTSpacing.sm },
  bleed: { marginHorizontal: -KitLayout.screenGutter },
  openRow: { gap: PlayTTSpacing.sm, paddingHorizontal: KitLayout.screenGutter },
  openCard: { width: OPEN_CARD_WIDTH },
  row: { gap: PlayTTSpacing.sm },
  cell: { flex: 1 },
  empty: { alignItems: "center", gap: PlayTTSpacing.xs, paddingVertical: PlayTTSpacing.xl },
  center: { textAlign: "center" },
  loading: { marginTop: PlayTTSpacing.xl },
  skeletonGroup: { gap: PlayTTSpacing.sm },
  skeletonRow: { flexDirection: "row", gap: PlayTTSpacing.sm },
})
