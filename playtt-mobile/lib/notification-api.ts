import { Platform } from "react-native"

import { apiFetch } from "@/lib/api-client"

export type NotificationPreferences = {
  accessReady: boolean
  accessFailed: boolean
  sessionReminder: boolean
  sessionWarning: boolean
  sessionEnded: boolean
  replayReady: boolean
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  accessReady: true,
  accessFailed: true,
  sessionReminder: true,
  sessionWarning: true,
  sessionEnded: true,
  replayReady: true,
}

type PreferencesResponse = { data?: { preferences?: Partial<NotificationPreferences> } }
type PushTokenResponse = { data?: { token?: { id: string; platform: string; enabled: boolean } } }

export async function fetchNotificationPreferences() {
  const response = await apiFetch<PreferencesResponse>("/api/user/notification-preferences")
  return { ...DEFAULT_NOTIFICATION_PREFERENCES, ...response.data?.preferences }
}

export async function updateNotificationPreferences(preferences: NotificationPreferences) {
  const response = await apiFetch<PreferencesResponse>("/api/user/notification-preferences", {
    method: "PATCH",
    body: JSON.stringify({ preferences }),
  })
  return { ...preferences, ...response.data?.preferences }
}

export async function registerPushToken(token: string) {
  const response = await apiFetch<PushTokenResponse>("/api/user/push-tokens", {
    method: "POST",
    body: JSON.stringify({ token, platform: Platform.OS }),
  })
  return response.data?.token ?? null
}

export async function revokePushToken(token: string) {
  await apiFetch("/api/user/push-tokens", {
    method: "DELETE",
    body: JSON.stringify({ token }),
  })
}
