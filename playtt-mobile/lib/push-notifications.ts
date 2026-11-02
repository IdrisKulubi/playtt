import Constants from "expo-constants"
import * as Notifications from "expo-notifications"
import { Platform } from "react-native"

import { registerPushToken, revokePushToken } from "@/lib/notification-api"

export async function isPushPermissionGranted(): Promise<boolean> {
  if (Platform.OS === "web") {
    return false
  }

  const current = await Notifications.getPermissionsAsync()
  return current.status === Notifications.PermissionStatus.GRANTED
}

export type PushPermissionState = "granted" | "undetermined" | "denied" | "unsupported"

/**
 * Where we stand without prompting: "undetermined" means the system prompt
 * hasn't been shown yet, so a reason screen should come before it.
 */
export async function getPushPermissionState(): Promise<PushPermissionState> {
  if (Platform.OS === "web") return "unsupported"
  const current = await Notifications.getPermissionsAsync()
  if (current.status === Notifications.PermissionStatus.GRANTED) return "granted"
  if (current.status === Notifications.PermissionStatus.UNDETERMINED && current.canAskAgain) return "undetermined"
  return "denied"
}

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
