import * as Notifications from "expo-notifications"
import { router } from "expo-router"
import { useEffect } from "react"

import { bookingIdFromNotificationData } from "@/lib/notification-deep-link"

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
      const bookingId = bookingIdFromNotificationData(response.notification.request.content.data)
      if (bookingId) {
        router.push({ pathname: "/(app)/booking/[id]", params: { id: bookingId } })
        void Notifications.clearLastNotificationResponseAsync()
      }
    }

    void Notifications.getLastNotificationResponseAsync().then(openResponse)
    const subscription = Notifications.addNotificationResponseReceivedListener(openResponse)
    return () => subscription.remove()
  }, [])

  return null
}
