import { useFocusEffect } from "expo-router"
import { useCallback, useEffect, useRef, useState } from "react"
import { AppState } from "react-native"

import { CHAT_POLL_MS } from "@/hooks/use-community-chat"
import { isApiError } from "@/lib/api-error"
import { fetchGroupMessages, markGroupRead, newClientMessageId, sendGroupMessage } from "@/lib/community-chat-api"
import { latestSeq, markFailed, markSending, mergeMessages, pendingItem, type ChatItem } from "@/lib/community-chat-merge"
import type { CommunityGroup, CommunityGroupMessage } from "@/lib/community-types"
import { toast } from "@/lib/toast"

export type GroupChatItem = ChatItem & { senderName?: string | null }

/** Group / event chat: same polling and optimistic sends as direct chats. */
export function useGroupChat(groupId: string) {
  const [items, setItems] = useState<GroupChatItem[]>([])
  const [group, setGroup] = useState<CommunityGroup | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [missing, setMissing] = useState(false)
  const itemsRef = useRef(items)
  const readSeqRef = useRef(0)
  const drafts = useRef(new Map<string, { kind: "text" | "quick_reply"; body: string }>())
  // Sender names come with server messages; keep them across merges.
  const names = useRef(new Map<string, string>())

  useEffect(() => {
    itemsRef.current = items
  }, [items])

  const withNames = useCallback((list: ChatItem[]): GroupChatItem[] => {
    return list.map((item) => ({ ...item, senderName: item.senderId ? names.current.get(item.senderId) ?? null : null }))
  }, [])

  const merge = useCallback(
    (incoming: CommunityGroupMessage[]) => {
      for (const message of incoming) {
        if (message.senderId && message.senderName) {
          names.current.set(message.senderId, message.senderName)
        }
      }
      setItems((current) => withNames(mergeMessages(current, incoming)))
    },
    [withNames],
  )

  const markRead = useCallback(
    (seq: number) => {
      if (seq <= readSeqRef.current) return
      readSeqRef.current = seq
      void markGroupRead(groupId, seq).catch(() => undefined)
    },
    [groupId],
  )

  const loadInitial = useCallback(async () => {
    try {
      const page = await fetchGroupMessages(groupId)
      merge(page.messages)
      setGroup(page.group)
      setMissing(false)
      const last = page.messages[page.messages.length - 1]
      if (last) markRead(last.seq)
    } catch (error) {
      if (isApiError(error) && error.status === 404) setMissing(true)
      else toast.apiError(error, "Could not load this group.")
    } finally {
      setLoaded(true)
    }
  }, [groupId, markRead, merge])

  const poll = useCallback(async () => {
    try {
      const page = await fetchGroupMessages(groupId, { after: latestSeq(itemsRef.current) })
      if (page.messages.length > 0) {
        merge(page.messages)
        markRead(page.messages[page.messages.length - 1].seq)
      }
    } catch {
      // Best effort; the next tick retries.
    }
  }, [groupId, markRead, merge])

  useFocusEffect(
    useCallback(() => {
      void loadInitial()
    }, [loadInitial]),
  )

  useFocusEffect(
    useCallback(() => {
      let timer: ReturnType<typeof setInterval> | null = null
      const start = () => {
        if (!timer) timer = setInterval(() => void poll(), CHAT_POLL_MS)
      }
      const stop = () => {
        if (timer) clearInterval(timer)
        timer = null
      }
      if (AppState.currentState !== "background" && AppState.currentState !== "inactive") start()
      const subscription = AppState.addEventListener("change", (state) => {
        if (state === "active") {
          void poll()
          start()
        } else {
          stop()
        }
      })
      return () => {
        stop()
        subscription.remove()
      }
    }, [poll]),
  )

  const deliver = useCallback(
    async (clientMessageId: string) => {
      const draft = drafts.current.get(clientMessageId)
      if (!draft) return
      try {
        const message = await sendGroupMessage(groupId, { ...draft, clientMessageId })
        drafts.current.delete(clientMessageId)
        merge([message])
        markRead(message.seq)
      } catch (error) {
        if (isApiError(error) && error.status >= 400 && error.status < 500 && error.status !== 408) {
          drafts.current.delete(clientMessageId)
          setItems((current) => current.filter((item) => item.clientMessageId !== clientMessageId || item.status === "sent"))
          toast.apiError(error, "Message not sent.")
          return
        }
        setItems((current) => markFailed(current, clientMessageId))
      }
    },
    [groupId, markRead, merge],
  )

  const send = useCallback(
    (draft: { kind: "text" | "quick_reply"; body: string }) => {
      const clientMessageId = newClientMessageId()
      drafts.current.set(clientMessageId, draft)
      setItems((current) => [
        ...current,
        pendingItem({ clientMessageId, conversationId: groupId, kind: draft.kind, body: draft.body }),
      ])
      void deliver(clientMessageId)
    },
    [deliver, groupId],
  )

  const retry = useCallback(
    (item: ChatItem) => {
      if (!item.clientMessageId) return
      setItems((current) => markSending(current, item.clientMessageId!))
      void deliver(item.clientMessageId)
    },
    [deliver],
  )

  return { items, group, setGroup, loaded, missing, send, retry, reload: loadInitial }
}
