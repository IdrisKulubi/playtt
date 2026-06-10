import * as SecureStore from "expo-secure-store"

const STORAGE_KEY = "playtt.notification-prefs"

export type NotificationPrefs = {
  sessionReminders: boolean
  replayReady: boolean
  bookingUpdates: boolean
}

const DEFAULT_PREFS: NotificationPrefs = {
  sessionReminders: true,
  replayReady: true,
  bookingUpdates: true,
}

export async function loadNotificationPrefs(): Promise<NotificationPrefs> {
  try {
    const raw = await SecureStore.getItemAsync(STORAGE_KEY)
    if (!raw) {
      return DEFAULT_PREFS
    }

    return { ...DEFAULT_PREFS, ...JSON.parse(raw) } as NotificationPrefs
  } catch {
    return DEFAULT_PREFS
  }
}

export async function saveNotificationPrefs(prefs: NotificationPrefs) {
  await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(prefs))
}
