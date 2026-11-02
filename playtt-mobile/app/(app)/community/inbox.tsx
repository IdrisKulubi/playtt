import { type Href, router, useFocusEffect } from "expo-router"
import { useCallback, useRef, useState } from "react"
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"

import { ConversationRow } from "@/components/community/chat/conversation-row"
import { GroupRow } from "@/components/community/chat/group-row"
import { CommunityScreenHeader } from "@/components/community/community-screen-header"
import { ChoiceChips } from "@/components/kit/choice-chips"
import { EmptyState } from "@/components/kit/empty-state"
import { KitLayout } from "@/constants/kit-layout"
import { PlayTTSpacing } from "@/constants/playtt-tokens"
import { useAppTheme } from "@/hooks/use-app-theme"
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

const PLAYERS_HREF = "/(app)/(tabs)/community" as Href

const EMPTY_COPY: Record<InboxFolder, { title: string; detail: string; action: string }> = {
  inbox: {
    title: "No chats yet",
    detail: "Find someone who's open to play and tap Let's play.",
    action: "Find someone to play",
  },
  requests: {
    title: "No message requests",
    detail: "Messages from players you don't follow arrive here first.",
    action: "Back to Players",
  },
  groups: {
    title: "No group chats yet",
    detail: "Join a doubles game or an event on Players to get a group chat.",
    action: "See events",
  },
}

/** Messages: chats, requests from new people, and group chats. */
export default function CommunityInboxScreen() {
  const { colors } = useAppTheme()
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
  const folders: { value: InboxFolder; label: string }[] = [
    { value: "inbox", label: unread.inbox > 0 ? `Chats (${unread.inbox})` : "Chats" },
    { value: "requests", label: unread.requests > 0 ? `Requests (${unread.requests})` : "Requests" },
    { value: "groups", label: unread.groups ? `Groups (${unread.groups})` : "Groups" },
  ]

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]} edges={["top", "left", "right"]}>
      <CommunityScreenHeader title="Messages" backLabel="Players" />
      <View style={styles.folders}>
        <ChoiceChips label="Show" options={folders} value={folder} onChange={setFolder} />
      </View>
      <FlatList
        data={loading ? [] : folder === "groups" ? groups : conversations}
        keyExtractor={(item: CommunityConversation | CommunityGroup) => item.id}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={[styles.separator, { backgroundColor: colors.separator }]} />}
        renderItem={({ item }) =>
          "members" in item ? (
            <GroupRow group={item} onPress={() => router.push(communityGroupHref(item.id) as Href)} />
          ) : (
            <ConversationRow conversation={item} onPress={() => router.push(communityChatHref(item.id) as Href)} />
          )
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator style={styles.loading} color={colors.secondaryLabel} />
          ) : (
            <EmptyState
              icon="bubble.left.and.bubble.right.fill"
              title={EMPTY_COPY[folder].title}
              message={EMPTY_COPY[folder].detail}
              action={{ label: EMPTY_COPY[folder].action, onPress: () => router.navigate(PLAYERS_HREF) }}
            />
          )
        }
        onEndReached={() => void loadMore()}
        onEndReachedThreshold={0.4}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.secondaryLabel} />}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  folders: { paddingHorizontal: KitLayout.screenGutter, paddingBottom: PlayTTSpacing.sm },
  list: { paddingHorizontal: KitLayout.screenGutter, paddingBottom: PlayTTSpacing["2xl"] },
  separator: { height: StyleSheet.hairlineWidth, marginLeft: 56 },
  loading: { marginTop: PlayTTSpacing.xl },
})
