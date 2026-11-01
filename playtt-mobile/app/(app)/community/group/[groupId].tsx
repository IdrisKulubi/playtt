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

import { ChatComposer } from "@/components/community/chat/chat-composer"
import { ChatMessageBubble } from "@/components/community/chat/chat-message-bubble"
import { groupSubtitle } from "@/components/community/chat/group-row"
import { PlayerCard } from "@/components/community/player-card/player-card"
import { createAppScreenStyles } from "@/components/layout/app-screen-styles"
import { ScreenBackButton } from "@/components/navigation/screen-back-button"
import { BottomSheet } from "@/components/ui/bottom-sheet"
import { PlayTTColors, PlayTTFontFamilies, PlayTTSpacing } from "@/constants/playtt-tokens"
import { useGroupChat, type GroupChatItem } from "@/hooks/use-group-chat"
import { useProductTheme } from "@/hooks/use-product-theme"
import { leaveGroup, muteGroup, removeGroupMember } from "@/lib/community-chat-api"
import { chatRows } from "@/lib/community-chat-merge"
import { communityPlayerHref } from "@/lib/community-types"
import { toast } from "@/lib/toast"

export default function CommunityGroupScreen() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>()
  const theme = useProductTheme()
  const insets = useSafeAreaInsets()
  const screenStyles = useMemo(() => createAppScreenStyles(theme), [theme])
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
        headerCopy: { flex: 1 },
        title: { fontFamily: PlayTTFontFamilies.semiBold, fontSize: 17, color: theme.foreground },
        subtitle: { fontFamily: PlayTTFontFamilies.regular, fontSize: 13, color: theme.muted },
        menu: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
        day: {
          alignSelf: "center",
          fontFamily: PlayTTFontFamilies.medium,
          fontSize: 12,
          color: theme.muted,
          marginVertical: PlayTTSpacing.xs,
        },
        center: { flex: 1, alignItems: "center", justifyContent: "center", padding: PlayTTSpacing.lg, gap: 6 },
        centerTitle: { fontFamily: PlayTTFontFamilies.semiBold, fontSize: 18, color: theme.foreground },
        centerText: { fontFamily: PlayTTFontFamilies.regular, fontSize: 14, color: theme.muted, textAlign: "center" },
        description: {
          fontFamily: PlayTTFontFamilies.regular,
          fontSize: 14,
          color: theme.muted,
          textAlign: "center",
          paddingHorizontal: PlayTTSpacing.xl,
          paddingVertical: PlayTTSpacing.lg,
          lineHeight: 20,
          transform: [{ scaleY: -1 }],
        },
        memberRow: { flexDirection: "row", alignItems: "center", gap: PlayTTSpacing.sm },
        memberCard: { flex: 1 },
        admin: { fontFamily: PlayTTFontFamilies.semiBold, fontSize: 12, color: PlayTTColors.primary },
        remove: { fontFamily: PlayTTFontFamilies.semiBold, fontSize: 13, color: PlayTTColors.destructive },
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
          <Text style={styles.centerTitle}>Group not available</Text>
          <Text style={styles.centerText}>You left this group or it has closed.</Text>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={screenStyles.safeArea} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <ScreenBackButton />
        <Pressable style={styles.headerCopy} onPress={() => setMembersOpen(true)} accessibilityRole="button">
          <Text style={styles.title} numberOfLines={1}>
            {group?.title ?? "Group"}
          </Text>
          {group ? <Text style={styles.subtitle}>{groupSubtitle(group)}</Text> : null}
        </Pressable>
        {group ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Group options" onPress={openMenu} style={styles.menu}>
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
            keyboardShouldPersistTaps="handled"
            renderItem={({ item: row }) =>
              row.type === "day" ? (
                <Text style={styles.day}>{row.label}</Text>
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
              <Text style={styles.description}>
                {group?.description ?? "Say hi and agree who books the table."}
              </Text>
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
        <BottomSheet visible={membersOpen} title="Players" onClose={() => setMembersOpen(false)} scrollable>
          <View style={{ gap: PlayTTSpacing.xs }}>
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
                {member.groupRole === "admin" ? <Text style={styles.admin}>Host</Text> : null}
                {group.myRole === "admin" && member.groupRole !== "admin" ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${member.displayName}`}
                    hitSlop={6}
                    onPress={() => confirmRemove(member.id, member.displayName)}
                  >
                    <Text style={styles.remove}>Remove</Text>
                  </Pressable>
                ) : null}
              </View>
            ))}
          </View>
        </BottomSheet>
      ) : null}
    </SafeAreaView>
  )
}
