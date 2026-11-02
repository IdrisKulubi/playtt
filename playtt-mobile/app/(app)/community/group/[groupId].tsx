import { type Href, router, useLocalSearchParams } from "expo-router"
import { DotsThreeVertical } from "phosphor-react-native/src/icons/DotsThreeVertical"
import { useMemo, useState } from "react"
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

import { ChatComposer } from "@/components/community/chat/chat-composer"
import { ChatMessageBubble } from "@/components/community/chat/chat-message-bubble"
import { groupSubtitle } from "@/components/community/chat/group-row"
import { PlayerCard } from "@/components/community/player-card/player-card"
import { BackButton } from "@/components/kit/back-button"
import { Button } from "@/components/kit/button"
import { EmptyState } from "@/components/kit/empty-state"
import { PressableScale } from "@/components/kit/pressable-scale"
import { AppText } from "@/components/ui/app-text"
import { BottomSheet } from "@/components/ui/bottom-sheet"
import { PlayTTSpacing } from "@/constants/playtt-tokens"
import { useAppTheme } from "@/hooks/use-app-theme"
import { useGroupChat, type GroupChatItem } from "@/hooks/use-group-chat"
import { leaveGroup, muteGroup, removeGroupMember } from "@/lib/community-chat-api"
import { chatRows } from "@/lib/community-chat-merge"
import { communityPlayerHref } from "@/lib/community-types"
import { toast } from "@/lib/toast"

export default function CommunityGroupScreen() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>()
  const { colors } = useAppTheme()
  const insets = useSafeAreaInsets()
  const chat = useGroupChat(groupId)
  const [draft, setDraft] = useState("")
  const [membersOpen, setMembersOpen] = useState(false)
  const rows = useMemo(() => chatRows(chat.items), [chat.items])
  const group = chat.group

  function sendText() {
    const body = draft.trim()
    if (!body) return
    setDraft("")
    chat.send({ kind: "text", body })
  }

  async function mute(hours: 1 | 8 | 24 | 168 | null) {
    try {
      const mutedUntil = await muteGroup(groupId, hours)
      chat.setGroup((current) => (current ? { ...current, mutedUntil } : current))
      toast.success(hours ? "Notifications muted." : "Notifications on.")
    } catch (error) {
      toast.apiError(error, "Could not update notifications.")
    }
  }

  function confirmLeave() {
    Alert.alert("Leave this group?", "You can rejoin while there's space.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Leave",
        style: "destructive",
        onPress: async () => {
          try {
            await leaveGroup(groupId)
            router.back()
          } catch (error) {
            toast.apiError(error, "Could not leave this group.")
          }
        },
      },
    ])
  }

  function openMenu() {
    Alert.alert(group?.title ?? "Group", undefined, [
      { text: "Players", onPress: () => setMembersOpen(true) },
      group?.mutedUntil
        ? { text: "Unmute", onPress: () => void mute(null) }
        : { text: "Mute for 8 hours", onPress: () => void mute(8) },
      { text: "Leave group", style: "destructive", onPress: confirmLeave },
      { text: "Cancel", style: "cancel" },
    ])
  }

  function confirmRemove(memberId: string, name: string) {
    Alert.alert(`Remove ${name}?`, undefined, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          try {
            await removeGroupMember(groupId, memberId)
            await chat.reload()
          } catch (error) {
            toast.apiError(error, "Could not remove this player.")
          }
        },
      },
    ])
  }

  if (chat.missing) {
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]} edges={["top", "left", "right"]}>
        <View style={styles.missingBack}>
          <BackButton label="Messages" fallbackHref={INBOX_HREF} />
        </View>
        <EmptyState
          icon="person.2.fill"
          title="This group isn't available"
          message="You left this group, or it has closed."
          action={{ label: "Back to Messages", onPress: () => router.replace(INBOX_HREF) }}
        />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]} edges={["top", "left", "right"]}>
      <View style={[styles.header, { borderBottomColor: colors.separator }]}>
        <BackButton label="Back" fallbackHref={INBOX_HREF} />
        <PressableScale
          style={styles.headerCopy}
          pressedScale={1}
          onPress={() => setMembersOpen(true)}
          accessibilityHint="Shows who's playing"
        >
          <AppText variant="headline" numberOfLines={1}>
            {group?.title ?? "Group"}
          </AppText>
          {group ? (
            <AppText variant="footnote" color="secondaryLabel">
              {groupSubtitle(group)}
            </AppText>
          ) : null}
        </PressableScale>
        {group ? (
          <PressableScale
            accessibilityLabel="Group options"
            accessibilityHint="Mute or leave the group"
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
            keyboardShouldPersistTaps="handled"
            renderItem={({ item: row }) =>
              row.type === "day" ? (
                <AppText variant="footnote" weight="600" color="secondaryLabel" style={styles.day}>
                  {row.label}
                </AppText>
              ) : (
                <ChatMessageBubble
                  item={row.item}
                  seen={false}
                  senderName={(row.item as GroupChatItem).senderName}
                  onRetry={chat.retry}
                />
              )
            }
            ListEmptyComponent={
              <AppText variant="callout" color="secondaryLabel" style={styles.description}>
                {group?.description ?? "Say hi and agree who books the table."}
              </AppText>
            }
          />
        )}

        <ChatComposer
          value={draft}
          onChange={setDraft}
          onSend={sendText}
          onQuickReply={(body) => chat.send({ kind: "quick_reply", body })}
          onOpenActions={() => undefined}
          showActions={false}
          disabled={!group || group.closed}
          disabledReason={group?.closed ? "This group is closed." : null}
          bottomInset={insets.bottom}
        />
      </KeyboardAvoidingView>

      {group ? (
        <BottomSheet visible={membersOpen} title="Who's playing" onClose={() => setMembersOpen(false)} scrollable>
          <View style={styles.members}>
            {group.members.map((member) => (
              <View key={member.id} style={styles.memberRow}>
                <View style={styles.memberCard}>
                  <PlayerCard
                    player={member}
                    size="mini"
                    onPress={() => {
                      setMembersOpen(false)
                      router.push(communityPlayerHref(member.id) as Href)
                    }}
                  />
                </View>
                {member.groupRole === "admin" ? (
                  <AppText variant="footnote" weight="700" color="accentText">
                    Host
                  </AppText>
                ) : null}
                {group.myRole === "admin" && member.groupRole !== "admin" ? (
                  <Button
                    label="Remove"
                    variant="destructive"
                    fullWidth={false}
                    accessibilityLabel={`Remove ${member.displayName}`}
                    onPress={() => confirmRemove(member.id, member.displayName)}
                  />
                ) : null}
              </View>
            ))}
          </View>
        </BottomSheet>
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
  headerCopy: { flex: 1, justifyContent: "center" },
  menu: {
    flexDirection: "row",
    alignItems: "center",
    gap: PlayTTSpacing["2xs"],
    paddingHorizontal: PlayTTSpacing.sm,
    borderRadius: 24,
  },
  missingBack: { paddingHorizontal: PlayTTSpacing.md },
  loading: { marginTop: PlayTTSpacing.xl },
  day: { alignSelf: "center", marginVertical: PlayTTSpacing.xs },
  description: {
    textAlign: "center",
    paddingHorizontal: PlayTTSpacing.xl,
    paddingVertical: PlayTTSpacing.lg,
    // Inverted list: undo the flip for the empty state.
    transform: [{ scaleY: -1 }],
  },
  members: { gap: PlayTTSpacing.xs },
  memberRow: { flexDirection: "row", alignItems: "center", gap: PlayTTSpacing.sm },
  memberCard: { flex: 1 },
})
