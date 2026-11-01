import { type Href, router, useLocalSearchParams } from "expo-router"
import { DotsThreeVertical } from "phosphor-react-native/src/icons/DotsThreeVertical"
import { useMemo, useState } from "react"
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native"
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context"

import { ChatActionsSheet } from "@/components/community/chat/chat-actions-sheet"
import { ChatComposer } from "@/components/community/chat/chat-composer"
import { ChatMessageBubble } from "@/components/community/chat/chat-message-bubble"
import { IncomingRequestBanner, PendingRequestNote } from "@/components/community/chat/chat-request-banner"
import { PlayerCard } from "@/components/community/player-card/player-card"
import { ReportPlayerSheet } from "@/components/community/report-player-sheet"
import { ScreenBackButton } from "@/components/navigation/screen-back-button"
import { createAppScreenStyles } from "@/components/layout/app-screen-styles"
import { PlayTTFontFamilies, PlayTTSpacing } from "@/constants/playtt-tokens"
import { useCommunityChat } from "@/hooks/use-community-chat"
import { useProductTheme } from "@/hooks/use-product-theme"
import { blockPlayer } from "@/lib/community-api"
import { acceptConversation, leaveConversation } from "@/lib/community-chat-api"
import { chatRows, seenSeq, type ChatItem } from "@/lib/community-chat-merge"
import { communityPlayerHref } from "@/lib/community-types"
import { toast } from "@/lib/toast"

export default function CommunityChatScreen() {
  const { conversationId } = useLocalSearchParams<{ conversationId: string }>()
  const theme = useProductTheme()
  const insets = useSafeAreaInsets()
  const screenStyles = useMemo(() => createAppScreenStyles(theme), [theme])
  const chat = useCommunityChat(conversationId)
  const [draft, setDraft] = useState("")
  const [actionsOpen, setActionsOpen] = useState(false)
  const [report, setReport] = useState<{ key: number; messageId?: string } | null>(null)
  const [busy, setBusy] = useState(false)

  const conversation = chat.conversation
  const player = conversation?.player
  const name = player?.displayName ?? "this player"
  const seen = seenSeq(chat.items, chat.otherLastReadSeq)
  const rows = useMemo(() => chatRows(chat.items), [chat.items])

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

  const styles = useMemo(
    () =>
      StyleSheet.create({
        header: {
          flexDirection: "row",
          alignItems: "center",
          gap: PlayTTSpacing.xs,
          paddingHorizontal: PlayTTSpacing.md,
          paddingBottom: PlayTTSpacing.xs,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: theme.border,
        },
        headerCard: { flex: 1 },
        menu: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
        list: { paddingTop: PlayTTSpacing.sm },
        day: {
          alignSelf: "center",
          fontFamily: PlayTTFontFamilies.medium,
          fontSize: 12,
          color: theme.muted,
          marginVertical: PlayTTSpacing.xs,
        },
        center: { flex: 1, alignItems: "center", justifyContent: "center", gap: PlayTTSpacing.xs, padding: PlayTTSpacing.lg },
        title: { fontFamily: PlayTTFontFamilies.semiBold, fontSize: 18, color: theme.foreground },
        detail: { fontFamily: PlayTTFontFamilies.regular, fontSize: 14, color: theme.muted, textAlign: "center" },
        intro: {
          fontFamily: PlayTTFontFamilies.regular,
          fontSize: 14,
          color: theme.muted,
          textAlign: "center",
          paddingHorizontal: PlayTTSpacing.xl,
          paddingVertical: PlayTTSpacing.lg,
          lineHeight: 20,
          // Inverted list: undo the flip for the empty state.
          transform: [{ scaleY: -1 }],
        },
      }),
    [theme],
  )

  if (chat.missing) {
    return (
      <SafeAreaView style={screenStyles.safeArea} edges={["top", "left", "right"]}>
        <View style={{ paddingHorizontal: PlayTTSpacing.md }}>
          <ScreenBackButton />
        </View>
        <View style={styles.center}>
          <Text style={styles.title}>Chat not available</Text>
          <Text style={styles.detail}>This chat was deleted or the player is no longer in Community.</Text>
        </View>
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
    <SafeAreaView style={screenStyles.safeArea} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <ScreenBackButton />
        <View style={styles.headerCard}>
          {player ? (
            <PlayerCard player={player} size="mini" onPress={() => router.push(communityPlayerHref(player.id) as Href)} />
          ) : null}
        </View>
        {player ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Chat options" onPress={openMenu} style={styles.menu}>
            <DotsThreeVertical size={22} color={theme.foreground} weight="bold" />
          </Pressable>
        ) : null}
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        {!chat.loaded ? (
          <ActivityIndicator style={{ marginTop: PlayTTSpacing.xl }} color={theme.muted} />
        ) : (
          <FlatList
            inverted
            data={rows}
            keyExtractor={(row) => (row.type === "day" ? row.key : row.item.clientMessageId ?? row.item.id)}
            contentContainerStyle={styles.list}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item: row }) =>
              row.type === "day" ? (
                <Text style={styles.day}>{row.label}</Text>
              ) : (
                <ChatMessageBubble
                  item={row.item}
                  seen={seen !== null && row.item.seq === seen}
                  onLongPress={onMessageLongPress}
                  onRetry={chat.retry}
                  onOpenBooking={(bookingId) =>
                    router.push({ pathname: "/(app)/booking/[id]", params: { id: bookingId } })
                  }
                />
              )
            }
            ListEmptyComponent={
              <Text style={styles.intro}>
                Say hi to {name} and agree a time. When you&apos;re set, book a table with the + button.
              </Text>
            }
            onEndReached={() => void chat.loadOlder()}
            onEndReachedThreshold={0.3}
            ListFooterComponent={chat.loadingOlder ? <ActivityIndicator color={theme.muted} /> : undefined}
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
