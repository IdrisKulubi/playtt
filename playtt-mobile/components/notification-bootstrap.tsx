import * as Notifications from "expo-notifications"
import { type Href, router } from "expo-router"
import { useEffect } from "react"

import { notificationTarget } from "@/lib/notification-deep-link"

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
})

export function NotificationBootstrap() {
  useEffect(() => {
    function openResponse(response: Notifications.NotificationResponse | null) {
      if (!response) return
      const target = notificationTarget(response.notification.request.content.data)
      if (!target) return
      if (target.kind === "booking") {
        router.push({ pathname: "/(app)/booking/[id]", params: { id: target.bookingId } })
      } else {
        router.push(target.href as Href)
      }
      void Notifications.clearLastNotificationResponseAsync()
    }

    void Notifications.getLastNotificationResponseAsync().then(openResponse)
    const subscription = Notifications.addNotificationResponseReceivedListener(openResponse)
    return () => subscription.remove()
  }, [])

  return null
}
