import { type Href, router, useFocusEffect } from "expo-router"
import { useCallback, useMemo, useRef, useState } from "react"
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"

import { ConversationRow } from "@/components/community/chat/conversation-row"
import { GroupRow } from "@/components/community/chat/group-row"
import { CommunityScreenHeader } from "@/components/community/community-screen-header"
import { createAppScreenStyles } from "@/components/layout/app-screen-styles"
import { GlassSegmentControl } from "@/components/ui/glass-segment-control"
import { PlayTTFontFamilies, PlayTTSpacing } from "@/constants/playtt-tokens"
import { useProductTheme } from "@/hooks/use-product-theme"
import { useCommunityUnread } from "@/hooks/use-community-unread"
import { fetchConversations, fetchGroups } from "@/lib/community-chat-api"
import {
  communityChatHref,
  communityGroupHref,
  type CommunityConversation,
  type CommunityGroup,
  type ConversationFolder,
} from "@/lib/community-types"
import { toast } from "@/lib/toast"

type InboxFolder = ConversationFolder | "groups"

const EMPTY_COPY: Record<InboxFolder, { title: string; detail: string }> = {
  inbox: {
    title: "No chats yet",
    detail: "Find someone who's open to play and tap Let's play.",
  },
  requests: {
    title: "No message requests",
    detail: "Messages from players you don't follow land here first.",
  },
  groups: {
    title: "No groups yet",
    detail: "Join a 2v2 or an event from the Community tab.",
  },
}

export default function CommunityInboxScreen() {
  const theme = useProductTheme()
  const screenStyles = useMemo(() => createAppScreenStyles(theme), [theme])
  const [folder, setFolder] = useState<InboxFolder>("inbox")
  const [conversations, setConversations] = useState<CommunityConversation[]>([])
  const [groups, setGroups] = useState<CommunityGroup[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [loadedFolder, setLoadedFolder] = useState<InboxFolder | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const requestId = useRef(0)
  const { unread, reload: reloadUnread } = useCommunityUnread(true)

  const load = useCallback(async () => {
    const id = ++requestId.current
    try {
      if (folder === "groups") {
        const list = await fetchGroups()
        if (id === requestId.current) setGroups(list)
        return
      }
      const page = await fetchConversations(folder)
      if (id === requestId.current) {
        setConversations(page.conversations)
        setCursor(page.nextCursor)
      }
    } catch (error) {
      toast.apiError(error, "Could not load your messages.")
    } finally {
      if (id === requestId.current) setLoadedFolder(folder)
    }
  }, [folder])

  useFocusEffect(
    useCallback(() => {
      void load()
    }, [load]),
  )

  async function loadMore() {
    if (!cursor || folder === "groups") return
    const id = requestId.current
    try {
      const page = await fetchConversations(folder, cursor)
      if (id === requestId.current) {
        setConversations((current) => [
          ...current,
          ...page.conversations.filter((c) => !current.some((existing) => existing.id === c.id)),
        ])
        setCursor(page.nextCursor)
      }
    } catch (error) {
      toast.apiError(error, "Could not load more messages.")
    }
  }

  async function refresh() {
    setRefreshing(true)
    await Promise.all([load(), reloadUnread()])
    setRefreshing(false)
  }

  const loading = loadedFolder !== folder
  const segments = [
    { value: "inbox" as const, label: unread.inbox > 0 ? `Inbox · ${unread.inbox}` : "Inbox" },
    { value: "requests" as const, label: unread.requests > 0 ? `Requests · ${unread.requests}` : "Requests" },
    { value: "groups" as const, label: unread.groups ? `Groups · ${unread.groups}` : "Groups" },
  ]

  const styles = useMemo(
    () =>
      StyleSheet.create({
        segment: { paddingHorizontal: 20, paddingBottom: PlayTTSpacing.sm },
        list: { paddingHorizontal: 20, paddingBottom: PlayTTSpacing["2xl"] },
        separator: { height: StyleSheet.hairlineWidth, backgroundColor: theme.border, marginLeft: 56 },
        empty: { alignItems: "center", gap: PlayTTSpacing.xs, paddingTop: PlayTTSpacing.xl },
        emptyTitle: { fontFamily: PlayTTFontFamilies.semiBold, fontSize: 17, color: theme.foreground },
        emptyDetail: {
          fontFamily: PlayTTFontFamilies.regular,
          fontSize: 14,
          color: theme.muted,
          textAlign: "center",
          maxWidth: 280,
          lineHeight: 20,
        },
      }),
    [theme],
  )

  return (
    <SafeAreaView style={screenStyles.safeArea} edges={["top", "left", "right"]}>
      <CommunityScreenHeader title="Messages" />
      <View style={styles.segment}>
        <GlassSegmentControl value={folder} options={segments} onChange={setFolder} />
      </View>
      <FlatList
        data={loading ? [] : folder === "groups" ? groups : conversations}
        keyExtractor={(item: CommunityConversation | CommunityGroup) => item.id}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        renderItem={({ item }) =>
          "members" in item ? (
            <GroupRow group={item} onPress={() => router.push(communityGroupHref(item.id) as Href)} />
          ) : (
            <ConversationRow conversation={item} onPress={() => router.push(communityChatHref(item.id) as Href)} />
          )
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator style={{ marginTop: PlayTTSpacing.xl }} color={theme.muted} />
          ) : (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>{EMPTY_COPY[folder].title}</Text>
              <Text style={styles.emptyDetail}>{EMPTY_COPY[folder].detail}</Text>
            </View>
          )
        }
        onEndReached={() => void loadMore()}
        onEndReachedThreshold={0.4}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={theme.muted} />}
      />
    </SafeAreaView>
  )
}
