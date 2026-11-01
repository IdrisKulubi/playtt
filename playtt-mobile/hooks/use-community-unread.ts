import * as Notifications from "expo-notifications"
import { useFocusEffect } from "expo-router"
import { useCallback, useEffect, useState } from "react"

import { fetchUnreadCounts } from "@/lib/community-chat-api"
import type { CommunityUnreadCounts } from "@/lib/community-types"

const EMPTY: CommunityUnreadCounts = { inbox: 0, requests: 0 }

function isCommunityPush(notification: Notifications.Notification) {
  const data = notification.request.content.data as Record<string, unknown> | undefined
  return typeof data?.conversationId === "string"
}

/** Unread chat counts for the Community badge: on focus and on chat push receipt. */
export function useCommunityUnread(enabled: boolean) {
  const [unread, setUnread] = useState<CommunityUnreadCounts>(EMPTY)

  const reload = useCallback(async () => {
    if (!enabled) return
    try {
      setUnread(await fetchUnreadCounts())
    } catch {
      // A badge is not worth an error toast; the next focus retries.
    }
  }, [enabled])

  useFocusEffect(
    useCallback(() => {
      void reload()
    }, [reload]),
  )

  useEffect(() => {
    if (!enabled) return
    const subscription = Notifications.addNotificationReceivedListener((notification) => {
      if (isCommunityPush(notification)) void reload()
    })
    return () => subscription.remove()
  }, [enabled, reload])

  return { unread: enabled ? unread : EMPTY, reload }
}
