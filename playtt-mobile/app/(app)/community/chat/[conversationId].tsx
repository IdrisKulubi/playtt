import { type Href, router, useLocalSearchParams } from "expo-router"
import { DotsThreeVertical } from "phosphor-react-native/src/icons/DotsThreeVertical"
import { useEffect, useMemo, useState } from "react"
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  View,
} from "react-native"
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context"

import { ChatActionsSheet } from "@/components/community/chat/chat-actions-sheet"
import { ChatComposer } from "@/components/community/chat/chat-composer"
import { KudosSheet } from "@/components/community/chat/kudos-sheet"
import { ChatMessageBubble } from "@/components/community/chat/chat-message-bubble"
import { IncomingRequestBanner, PendingRequestNote } from "@/components/community/chat/chat-request-banner"
import { PlayerCard } from "@/components/community/player-card/player-card"
import { headToHeadLine } from "@/components/community/player-card/card-tiers"
import { ReportPlayerSheet } from "@/components/community/report-player-sheet"
import { BackButton } from "@/components/kit/back-button"
import { EmptyState } from "@/components/kit/empty-state"
import { PressableScale } from "@/components/kit/pressable-scale"
import { AppText } from "@/components/ui/app-text"
import { PlayTTSpacing } from "@/constants/playtt-tokens"
import { useAppTheme } from "@/hooks/use-app-theme"
import { useCommunityChat } from "@/hooks/use-community-chat"
import { useSharedBookings } from "@/hooks/use-shared-bookings"
import {
  assignMatchSides,
  blockPlayer,
  fetchHeadToHead,
  joinSharedBooking,
  leaveSharedBooking,
} from "@/lib/community-api"
import { acceptConversation, leaveConversation } from "@/lib/community-chat-api"
import { chatRows, isBookingCard, seenSeq, type ChatItem } from "@/lib/community-chat-merge"
import { PLAY_AGAIN_PREFILL, communityPlayerHref, type CommunityHeadToHead } from "@/lib/community-types"
import { toast } from "@/lib/toast"

export default function CommunityChatScreen() {
  const { conversationId } = useLocalSearchParams<{ conversationId: string }>()
  const { colors } = useAppTheme()
  const insets = useSafeAreaInsets()
  const chat = useCommunityChat(conversationId)
  const [draft, setDraft] = useState("")
  const [actionsOpen, setActionsOpen] = useState(false)
  const [report, setReport] = useState<{ key: number; messageId?: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [kudos, setKudos] = useState<{ key: number; bookingId: string } | null>(null)
  const shared = useSharedBookings()
  const [h2h, setH2h] = useState<CommunityHeadToHead | null>(null)
  const peerId = chat.conversation?.player.id

  useEffect(() => {
    if (!peerId) return
    let mounted = true
    fetchHeadToHead(peerId)
      .then((record) => mounted && setH2h(record))
      .catch(() => undefined)
    return () => {
      mounted = false
    }
  }, [peerId])

  const conversation = chat.conversation
  const player = conversation?.player
  const name = player?.displayName ?? "this player"
  const seen = seenSeq(chat.items, chat.otherLastReadSeq)
  const rows = useMemo(() => chatRows(chat.items), [chat.items])

  function bookingJoinState(card: { bookingId: string; startsAt: string }): "can_join" | "joined" | null {
    const entry = shared.bookings.find((booking) => booking.bookingId === card.bookingId)
    if (entry?.role === "guest") return entry.phase === "upcoming" ? "joined" : null
    // Hosts and games that already started get no button; the server checks again.
    if (entry || new Date(card.startsAt) <= new Date()) return null
    return "can_join"
  }

  async function joinBooking(bookingId: string) {
    try {
      shared.setBookings(await joinSharedBooking(bookingId, conversationId))
      toast.success("You're in. See you on the table 🏓")
      await chat.reload()
    } catch (error) {
      toast.apiError(error, "Could not join this booking.")
    }
  }

  function confirmLeave(bookingId: string) {
    Alert.alert("Can't make it?", `${name} will be told. Pulling out less than 2 hours before the start lowers your reliability.`, [
      { text: "Keep my spot", style: "cancel" },
      {
        text: "I can't make it",
        style: "destructive",
        onPress: async () => {
          try {
            shared.setBookings(await leaveSharedBooking(bookingId))
            await chat.reload()
          } catch (error) {
            toast.apiError(error, "Could not update this booking.")
          }
        },
      },
    ])
  }

  /** Label for the host's booking card: who played which scoreboard side. */
  function sidesLabel(bookingId: string) {
    const entry = shared.bookings.find((booking) => booking.bookingId === bookingId)
    if (!entry || entry.role !== "owner" || entry.partners.length !== 1 || entry.phase === "upcoming") return null
    if (entry.match?.rated) return "Result recorded ✓"
    if (entry.match?.sideA) return "Sides set · Change"
    return "Record who played which side"
  }

  function recordSides(bookingId: string) {
    const entry = shared.bookings.find((booking) => booking.bookingId === bookingId)
    const partner = entry?.partners[0]
    if (!entry || !partner || entry.match?.rated) return
    const assign = async (sideA: string, sideB: string) => {
      try {
        const match = await assignMatchSides(bookingId, sideA, sideB)
        shared.setBookings((current) =>
          current.map((booking) => (booking.bookingId === bookingId ? { ...booking, match } : booking)),
        )
        toast.success("Sides saved. The result counts once the scoreboard finishes.")
      } catch (error) {
        toast.apiError(error, "Could not save sides.")
      }
    }
    Alert.alert("Which side were you on?", "Use the scoreboard's A and B sides.", [
      { text: "I was side A", onPress: () => void assign(entry.hostId, partner.id) },
      { text: "I was side B", onPress: () => void assign(partner.id, entry.hostId) },
      { text: "Cancel", style: "cancel" },
    ])
  }

  function openKudos(bookingId: string) {
    const entry = shared.bookings.find((booking) => booking.bookingId === bookingId)
    if (!entry) {
      toast.info("Kudos are for games you played together through Community.")
      return
    }
    setKudos({ key: Date.now(), bookingId })
  }

  function sendText() {
    const body = draft.trim()
    if (!body) return
    setDraft("")
    chat.send({ kind: "text", body })
  }

  async function accept() {
    setBusy(true)
    try {
      chat.setConversation(await acceptConversation(conversationId))
      chat.markAllRead()
    } catch (error) {
      toast.apiError(error, "Could not accept this request.")
    } finally {
      setBusy(false)
    }
  }

  async function deleteChat() {
    setBusy(true)
    try {
      await leaveConversation(conversationId)
      router.back()
    } catch (error) {
      toast.apiError(error, "Could not delete this chat.")
      setBusy(false)
    }
  }

  function confirmDelete() {
    Alert.alert("Delete this chat?", `It disappears from your messages. ${name} isn't told.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => void deleteChat() },
    ])
  }

  function confirmBlock(thenReport: boolean) {
    if (!player) return
    Alert.alert(`Block ${name}?`, "You won't see each other in Community and this chat closes.", [
      { text: "Cancel", style: "cancel" },
      {
        text: thenReport ? "Block & report" : "Block",
        style: "destructive",
        onPress: async () => {
          try {
            await blockPlayer(player.id)
            await leaveConversation(conversationId).catch(() => undefined)
            toast.success(`${name} is blocked.`)
            if (thenReport) {
              setReport({ key: Date.now() })
            } else {
              router.back()
            }
          } catch (error) {
            toast.apiError(error, "Could not block this player.")
          }
        },
      },
    ])
  }

  function openMenu() {
    Alert.alert(name, undefined, [
      { text: "View card", onPress: () => player && router.push(communityPlayerHref(player.id) as Href) },
      { text: "Report", onPress: () => setReport({ key: Date.now() }) },
      { text: "Block", style: "destructive", onPress: () => confirmBlock(false) },
      { text: "Delete chat", style: "destructive", onPress: confirmDelete },
      { text: "Cancel", style: "cancel" },
    ])
  }

  function onMessageLongPress(item: ChatItem) {
    if (item.mine || item.status !== "sent") return
    Alert.alert("Message", item.body.slice(0, 120), [
      { text: "Report message", style: "destructive", onPress: () => setReport({ key: Date.now(), messageId: item.id }) },
      { text: "Cancel", style: "cancel" },
    ])
  }

  if (chat.missing) {
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]} edges={["top", "left", "right"]}>
        <View style={styles.missingBack}>
          <BackButton label="Messages" fallbackHref={INBOX_HREF} />
        </View>
        <EmptyState
          icon="bubble.left.and.bubble.right.fill"
          title="This chat isn't available"
          message="It was deleted, or the player has left Players."
          action={{ label: "Back to Messages", onPress: () => router.replace(INBOX_HREF) }}
        />
      </SafeAreaView>
    )
  }

  const isIncomingRequest = conversation?.state === "request"
  const disabledReason =
    conversation && !conversation.canSend
      ? `${name} isn't accepting messages right now.`
      : conversation?.pendingRequest && conversation.pendingRequest.remaining === 0
        ? `Waiting for ${name} to accept your request.`
        : null

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]} edges={["top", "left", "right"]}>
      <View style={[styles.header, { borderBottomColor: colors.separator }]}>
        <BackButton label="Back" fallbackHref={INBOX_HREF} />
        <View style={styles.headerCard}>
          {player ? (
            <PlayerCard player={player} size="mini" onPress={() => router.push(communityPlayerHref(player.id) as Href)} />
          ) : null}
          {player && headToHeadLine(h2h, player.displayName) ? (
            <AppText variant="footnote" weight="600" color="secondaryLabel" style={styles.h2h}>
              {headToHeadLine(h2h, player.displayName)}
            </AppText>
          ) : null}
        </View>
        {player ? (
          <PressableScale
            accessibilityLabel="Chat options"
            accessibilityHint="Report, block or leave the chat"
            onPress={openMenu}
            style={[styles.menu, { backgroundColor: colors.surface }]}
          >
            <DotsThreeVertical size={18} color={colors.accentText} weight="bold" />
            <AppText variant="subheadline" weight="600">
              More
            </AppText>
          </PressableScale>
        ) : null}
      </View>

      <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        {!chat.loaded ? (
          <ActivityIndicator style={styles.loading} color={colors.secondaryLabel} />
        ) : (
          <FlatList
            inverted
            data={rows}
            keyExtractor={(row) => (row.type === "day" ? row.key : row.item.clientMessageId ?? row.item.id)}
            contentContainerStyle={styles.list}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item: row }) =>
              row.type === "day" ? (
                <AppText variant="footnote" weight="600" color="secondaryLabel" style={styles.day}>
                  {row.label}
                </AppText>
              ) : (
                <ChatMessageBubble
                  item={row.item}
                  seen={seen !== null && row.item.seq === seen}
                  onLongPress={onMessageLongPress}
                  onRetry={chat.retry}
                  onOpenBooking={(bookingId) =>
                    router.push({ pathname: "/(app)/booking/[id]", params: { id: bookingId } })
                  }
                  joinState={
                    row.item.kind === "booking_card" && !row.item.mine && isBookingCard(row.item.payload)
                      ? bookingJoinState(row.item.payload)
                      : null
                  }
                  onJoin={(bookingId) => void joinBooking(bookingId)}
                  onLeave={confirmLeave}
                  onGiveKudos={openKudos}
                  onPlayAgain={() => setDraft(PLAY_AGAIN_PREFILL)}
                  sidesLabel={
                    row.item.kind === "booking_card" && row.item.mine && isBookingCard(row.item.payload)
                      ? sidesLabel(row.item.payload.bookingId)
                      : null
                  }
                  onRecordSides={recordSides}
                />
              )
            }
            ListEmptyComponent={
              <AppText variant="callout" color="secondaryLabel" style={styles.intro}>
                Say hi to {name} and agree a time. When you&apos;re set, book a table with the + button.
              </AppText>
            }
            onEndReached={() => void chat.loadOlder()}
            onEndReachedThreshold={0.3}
            ListFooterComponent={chat.loadingOlder ? <ActivityIndicator color={colors.secondaryLabel} /> : undefined}
          />
        )}

        {isIncomingRequest ? (
          <IncomingRequestBanner
            name={name}
            busy={busy}
            onAccept={() => void accept()}
            onDelete={confirmDelete}
            onBlockAndReport={() => confirmBlock(true)}
          />
        ) : (
          <>
            {conversation?.pendingRequest && conversation.canSend ? (
              <PendingRequestNote name={name} remaining={conversation.pendingRequest.remaining} />
            ) : null}
            <ChatComposer
              value={draft}
              onChange={setDraft}
              onSend={sendText}
              onQuickReply={(body) => chat.send({ kind: "quick_reply", body })}
              onOpenActions={() => setActionsOpen(true)}
              disabled={!conversation || Boolean(disabledReason)}
              disabledReason={disabledReason}
              bottomInset={insets.bottom}
            />
          </>
        )}
      </KeyboardAvoidingView>

      <ChatActionsSheet
        visible={actionsOpen}
        partnerName={name}
        onClose={() => setActionsOpen(false)}
        onBookTable={() => {
          setActionsOpen(false)
          router.push("/(app)/book")
        }}
        onShareBooking={(bookingId) => {
          setActionsOpen(false)
          chat.send({ kind: "booking_card", bookingId }, { body: "Sharing a booking…" })
        }}
      />

      {player && kudos
        ? (() => {
            const entry = shared.bookings.find((booking) => booking.bookingId === kudos.bookingId)
            return entry ? (
              <KudosSheet
                key={kudos.key}
                visible
                booking={entry}
                receiverId={player.id}
                receiverName={name}
                onClose={() => setKudos(null)}
                onGiven={shared.setBookings}
              />
            ) : null
          })()
        : null}

      {player && report ? (
        <ReportPlayerSheet
          key={report.key}
          visible
          targetUserId={player.id}
          displayName={name}
          messageId={report.messageId}
          onClose={() => setReport(null)}
        />
      ) : null}
    </SafeAreaView>
  )
}

const INBOX_HREF = "/(app)/community/inbox" as Href

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: PlayTTSpacing.xs,
    paddingHorizontal: PlayTTSpacing.md,
    paddingBottom: PlayTTSpacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerCard: { flex: 1 },
  h2h: { marginLeft: 56, marginTop: -4 },
  menu: {
    flexDirection: "row",
    alignItems: "center",
    gap: PlayTTSpacing["2xs"],
    paddingHorizontal: PlayTTSpacing.sm,
    borderRadius: 24,
  },
  missingBack: { paddingHorizontal: PlayTTSpacing.md },
  loading: { marginTop: PlayTTSpacing.xl },
  list: { paddingTop: PlayTTSpacing.sm },
  day: { alignSelf: "center", marginVertical: PlayTTSpacing.xs },
  intro: {
    textAlign: "center",
    paddingHorizontal: PlayTTSpacing.xl,
    paddingVertical: PlayTTSpacing.lg,
    // Inverted list: undo the flip for the empty state.
    transform: [{ scaleY: -1 }],
  },
})
