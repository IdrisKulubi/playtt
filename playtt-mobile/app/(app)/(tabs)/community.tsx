import { type Href, router, useFocusEffect } from "expo-router"
import { useCallback, useMemo, useState } from "react"
import { useMinimizeOnScroll } from "expo-glass-tabs"
import { ActivityIndicator, RefreshControl, StyleSheet, Text, View } from "react-native"
import Animated, { FadeInDown, useReducedMotion } from "react-native-reanimated"
import { SafeAreaView } from "react-native-safe-area-context"

import { AtVenueStrip } from "@/components/community/at-venue-strip"
import { EventsSection } from "@/components/community/events-section"
import { InviteCodeSheet } from "@/components/community/invite-code-sheet"
import { CommunityFilterChips } from "@/components/community/community-filter-chips"
import { CommunityHeader } from "@/components/community/community-header"
import { CommunityIntro } from "@/components/community/community-intro"
import { ConfettiBurst } from "@/components/community/confetti-burst"
import { FloatingOpenButton } from "@/components/community/floating-open-button"
import { OpenStatusBar } from "@/components/community/open-status-bar"
import { OpenToPlaySheet } from "@/components/community/open-to-play-sheet"
import { PlayerCard } from "@/components/community/player-card/player-card"
import { RallyPartnersRow } from "@/components/community/rally-partners-row"
import { createAppScreenStyles } from "@/components/layout/app-screen-styles"
import { Button } from "@/components/ui/button"
import { GlassSegmentControl } from "@/components/ui/glass-segment-control"
import { Skeleton } from "@/components/ui/skeleton"
import { FLOATING_TAB_BAR_CLEARANCE } from "@/constants/navigation-layout"
import { PlayTTFontFamilies, PlayTTSpacing } from "@/constants/playtt-tokens"
import { useCommunityUnread } from "@/hooks/use-community-unread"
import {
  communityFilters,
  useCommunityMe,
  useCommunitySocial,
  useCommunityPlayers,
  type CommunitySegment as Segment,
} from "@/hooks/use-community"
import { useProductTheme, useSkeletonSurface } from "@/hooks/use-product-theme"
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

const SEGMENTS: { value: Segment; label: string }[] = [
  { value: "open", label: "Open now" },
  { value: "everyone", label: "Everyone" },
  { value: "following", label: "Following" },
]

const EMPTY_COPY: Record<Segment, { title: string; detail: string }> = {
  open: {
    title: "No one is open right now",
    detail: "Be the first: tap Open to play and players here will see you.",
  },
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

export default function CommunityScreen() {
  const theme = useProductTheme()
  const skeletonSurface = useSkeletonSurface()
  const reduceMotion = useReducedMotion()
  const screenStyles = useMemo(() => createAppScreenStyles(theme), [theme])
  const onScroll = useMinimizeOnScroll()
  const [segment, setSegment] = useState<Segment>("open")
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

  const styles = useMemo(
    () =>
      StyleSheet.create({
        content: {
          paddingHorizontal: 20,
          paddingTop: PlayTTSpacing.sm,
          paddingBottom: FLOATING_TAB_BAR_CLEARANCE + 72,
          gap: PlayTTSpacing.sm,
        },
        header: { gap: PlayTTSpacing.md, marginBottom: PlayTTSpacing.xs },
        row: { gap: PlayTTSpacing.sm },
        cell: { flex: 1 },
        empty: { alignItems: "center", gap: PlayTTSpacing.xs, paddingVertical: PlayTTSpacing.xl },
        emptyTitle: { fontFamily: PlayTTFontFamilies.semiBold, fontSize: 17, color: theme.foreground },
        emptyDetail: {
          fontFamily: PlayTTFontFamilies.regular,
          fontSize: 14,
          color: theme.muted,
          textAlign: "center",
          lineHeight: 20,
          maxWidth: 280,
        },
        skeletonRow: { flexDirection: "row", gap: PlayTTSpacing.sm },
      }),
    [theme],
  )

  function openSheet() {
    setSheetKey((value) => value + 1)
    setSheetOpen(true)
  }

  async function stopOpen() {
    try {
      setMe(await stopOpenToPlay())
      void list.reload()
    } catch (error) {
      toast.apiError(error, "Could not update your status.")
    }
  }

  async function refresh() {
    setRefreshing(true)
    await Promise.all([reloadMe(), list.reload(), social.reload()])
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
        venueName={me?.homeVenue?.name ?? list.venue?.name}
        onEditCard={hasCard ? () => router.push(PROFILE_EDITOR) : undefined}
        onOpenInbox={hasCard ? () => router.push("/community/inbox" as Href) : undefined}
        onInvite={hasCard ? () => void invite() : undefined}
        unreadCount={unread.inbox + (unread.groups ?? 0)}
        requestCount={unread.requests}
      />

      {me?.availability ? (
        <OpenStatusBar availability={me.availability} onChange={openSheet} onStop={stopOpen} />
      ) : null}

      {hasCard ? (
        <>
          <RallyPartnersRow players={social.rallyPartners} onOpenPlayer={openPlayer} onLetsPlay={letsPlay} />
          <AtVenueStrip atVenue={social.atVenue} onOpenPlayer={openPlayer} />
          <EventsSection
            events={social.events}
            onJoin={(event) => void joinCommunityEvent(event)}
            onOpen={(event) => router.push(communityGroupHref(event.id) as Href)}
          />
          <GlassSegmentControl value={segment} options={SEGMENTS} onChange={setSegment} />
          <CommunityFilterChips
            skill={skill}
            doubles={doubles}
            usualTime={usualTime}
            onSkillChange={setSkill}
            onDoublesChange={setDoubles}
            onUsualTimeChange={setUsualTime}
          />
        </>
      ) : null}
    </View>
  )

  function renderBody() {
    if (meLoading && !me) {
      return (
        <View style={{ gap: PlayTTSpacing.sm }}>
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
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Community is unavailable</Text>
          <Text style={styles.emptyDetail}>
            {meError ? "Check your connection and try again." : "Please try again."}
          </Text>
          <Button label="Try again" variant="outline" surface="product" productTheme={theme} fullWidth={false} onPress={() => void reloadMe()} />
        </View>
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
    <SafeAreaView style={screenStyles.safeArea} edges={["top", "left", "right"]}>
      <Animated.FlatList
        onScroll={onScroll}
        scrollEventThrottle={16}
        data={showGrid ? list.players : []}
        keyExtractor={(player) => player.id}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.content}
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
              <ActivityIndicator style={{ marginTop: PlayTTSpacing.xl }} color={theme.muted} />
            ) : (
              <View style={styles.empty}>
                <Text style={styles.emptyTitle}>{EMPTY_COPY[segment].title}</Text>
                <Text style={styles.emptyDetail}>{EMPTY_COPY[segment].detail}</Text>
              </View>
            )
          ) : undefined
        }
        ListFooterComponent={list.loadingMore ? <ActivityIndicator color={theme.muted} /> : undefined}
        onEndReached={() => void list.loadMore()}
        onEndReachedThreshold={0.4}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={theme.muted} />}
      />

      {showGrid ? <FloatingOpenButton open={Boolean(me.availability)} onPress={openSheet} /> : null}

      {me ? (
        <OpenToPlaySheet
          key={sheetKey}
          visible={sheetOpen}
          me={me}
          onClose={() => setSheetOpen(false)}
          onChanged={(next, wentOpen) => {
            setMe(next)
            if (wentOpen) {
              setSegment("open")
              setBurst((value) => value + 1)
            }
            void list.reload()
          }}
        />
      ) : null}

      <ConfettiBurst burstKey={burst} />

      {codeSheet !== null ? (
        <InviteCodeSheet key={codeSheet} visible onClose={() => setCodeSheet(null)} onSubmit={redeemInvite} />
      ) : null}
    </SafeAreaView>
  )
}
