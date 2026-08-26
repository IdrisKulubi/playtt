import Constants from "expo-constants"
import * as Notifications from "expo-notifications"
import { Platform } from "react-native"

import { registerPushToken, revokePushToken } from "@/lib/notification-api"

async function getDevicePushToken() {
  if (Platform.OS === "web") {
    throw new Error("Push notifications require the PlayTT mobile app.")
  }

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "PlayTT updates",
      importance: Notifications.AndroidImportance.DEFAULT,
    })
  }

  const current = await Notifications.getPermissionsAsync()
  const permission = current.status === Notifications.PermissionStatus.GRANTED
    ? current
    : await Notifications.requestPermissionsAsync()
  if (permission.status !== Notifications.PermissionStatus.GRANTED) {
    throw new Error("Notification permission was not granted.")
  }

  const projectId = Constants.expoConfig?.extra?.eas?.projectId
  if (typeof projectId !== "string" || !projectId) {
    throw new Error("Expo project ID is not configured.")
  }

  return (await Notifications.getExpoPushTokenAsync({ projectId })).data
}

export async function enablePushNotifications() {
  const token = await getDevicePushToken()
  return registerPushToken(token)
}

export async function disablePushNotifications() {
  const token = await getDevicePushToken()
  await revokePushToken(token)
}
