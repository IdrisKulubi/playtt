import { useFocusEffect } from "expo-router"
import { useCallback, useEffect, useRef, useState } from "react"
import { AppState } from "react-native"

import {
  fetchMessages,
  markConversationRead,
  newClientMessageId,
  sendCommunityMessage,
} from "@/lib/community-chat-api"
import {
  latestSeq,
  markFailed,
  markSending,
  mergeMessages,
  oldestSeq,
  pendingItem,
  type ChatItem,
} from "@/lib/community-chat-merge"
import type { CommunityConversation, SendMessageInput } from "@/lib/community-types"
import { isApiError } from "@/lib/api-error"
import { toast } from "@/lib/toast"

export const CHAT_POLL_MS = 4_000

type Draft = { kind: "text" | "quick_reply"; body: string } | { kind: "booking_card"; bookingId: string }

function toInput(draft: Draft, clientMessageId: string): SendMessageInput {
  return draft.kind === "booking_card"
    ? { kind: "booking_card", bookingId: draft.bookingId, clientMessageId }
    : { kind: draft.kind, body: draft.body, clientMessageId }
}

/**
 * One chat: initial load, polling with `after=` every 4 s while the screen is
 * focused and the app is in the foreground, optimistic sends keyed by
 * clientMessageId, older pages, and read markers.
 */
export function useCommunityChat(conversationId: string) {
  const [items, setItems] = useState<ChatItem[]>([])
  const [conversation, setConversation] = useState<CommunityConversation | null>(null)
  const [otherLastReadSeq, setOtherLastReadSeq] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [missing, setMissing] = useState(false)
  const [loadingOlder, setLoadingOlder] = useState(false)

  const itemsRef = useRef(items)
  useEffect(() => {
    itemsRef.current = items
  }, [items])
  const readSeqRef = useRef(0)
  // Reading a message request must not show "Seen" to the sender.
  const isRequestRef = useRef(false)
  useEffect(() => {
    isRequestRef.current = conversation?.state === "request"
  }, [conversation?.state])
  const drafts = useRef(new Map<string, Draft>())

  const markRead = useCallback(
    (seq: number) => {
      if (seq <= readSeqRef.current || isRequestRef.current) return
      readSeqRef.current = seq
      void markConversationRead(conversationId, seq).catch(() => undefined)
    },
    [conversationId],
  )

  const loadInitial = useCallback(async () => {
    try {
      const page = await fetchMessages(conversationId)
      setItems((current) => mergeMessages(current, page.messages))
      isRequestRef.current = page.conversation?.state === "request"
      setConversation(page.conversation)
      setOtherLastReadSeq(page.otherLastReadSeq)
      setHasMore(page.hasMore)
      setMissing(false)
      const last = page.messages[page.messages.length - 1]
      if (last) markRead(last.seq)
    } catch (error) {
      if (isApiError(error) && error.status === 404) setMissing(true)
      else toast.apiError(error, "Could not load this chat.")
    } finally {
      setLoaded(true)
    }
  }, [conversationId, markRead])

  const poll = useCallback(async () => {
    try {
      const page = await fetchMessages(conversationId, { after: latestSeq(itemsRef.current) })
      setOtherLastReadSeq(page.otherLastReadSeq)
      if (page.messages.length > 0) {
        setItems((current) => mergeMessages(current, page.messages))
        const newest = page.messages[page.messages.length - 1]
        if (newest) markRead(newest.seq)
      }
    } catch {
      // Polling is best effort; the next tick retries.
    }
  }, [conversationId, markRead])

  // Reload on focus too (e.g. back from the player's profile); merging is idempotent.
  useFocusEffect(
    useCallback(() => {
      void loadInitial()
    }, [loadInitial]),
  )

  // Poll only while focused and in the foreground.
  useFocusEffect(
    useCallback(() => {
      let timer: ReturnType<typeof setInterval> | null = null
      const start = () => {
        if (timer) return
        timer = setInterval(() => void poll(), CHAT_POLL_MS)
      }
      const stop = () => {
        if (timer) clearInterval(timer)
        timer = null
      }

      // currentState can be "unknown" right after launch; only skip when backgrounded.
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
        const message = await sendCommunityMessage(conversationId, toInput(draft, clientMessageId))
        drafts.current.delete(clientMessageId)
        setItems((current) => mergeMessages(current, [message]))
        markRead(message.seq)
        setConversation((current) =>
          current?.pendingRequest
            ? { ...current, pendingRequest: { remaining: Math.max(current.pendingRequest.remaining - 1, 0) } }
            : current,
        )
      } catch (error) {
        // Rejected by the server (filter, limits): drop it and explain.
        if (isApiError(error) && error.status >= 400 && error.status < 500 && error.status !== 408) {
          drafts.current.delete(clientMessageId)
          setItems((current) => current.filter((item) => item.clientMessageId !== clientMessageId || item.status === "sent"))
          toast.apiError(error, "Message not sent.")
          return
        }
        setItems((current) => markFailed(current, clientMessageId))
      }
    },
    [conversationId, markRead],
  )

  const send = useCallback(
    (draft: Draft, preview?: { body: string; payload?: ChatItem["payload"] }) => {
      const clientMessageId = newClientMessageId()
      drafts.current.set(clientMessageId, draft)
      const body = draft.kind === "booking_card" ? (preview?.body ?? "Shared a booking") : draft.body
      setItems((current) => [
        ...current,
        pendingItem({
          clientMessageId,
          conversationId,
          kind: draft.kind,
          body,
          payload: preview?.payload,
        }),
      ])
      void deliver(clientMessageId)
    },
    [conversationId, deliver],
  )

  const retry = useCallback(
    (item: ChatItem) => {
      if (!item.clientMessageId) return
      setItems((current) => markSending(current, item.clientMessageId!))
      void deliver(item.clientMessageId)
    },
    [deliver],
  )

  const loadOlder = useCallback(async () => {
    const before = oldestSeq(itemsRef.current)
    if (!hasMore || loadingOlder || before === undefined) return
    setLoadingOlder(true)
    try {
      const page = await fetchMessages(conversationId, { before })
      setItems((current) => mergeMessages(current, page.messages))
      setHasMore(page.hasMore)
    } catch (error) {
      toast.apiError(error, "Could not load older messages.")
    } finally {
      setLoadingOlder(false)
    }
  }, [conversationId, hasMore, loadingOlder])

  /** After accepting a request: now mark everything read. */
  const markAllRead = useCallback(() => {
    isRequestRef.current = false
    markRead(latestSeq(itemsRef.current))
  }, [markRead])

  return {
    items,
    markAllRead,
    conversation,
    setConversation,
    otherLastReadSeq,
    hasMore,
    loaded,
    missing,
    loadingOlder,
    send,
    retry,
    loadOlder,
    reload: loadInitial,
  }
}
