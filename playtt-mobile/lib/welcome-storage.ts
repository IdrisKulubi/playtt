import * as SecureStore from "expo-secure-store"

const WELCOME_SEEN_KEY = "playtt_has_seen_welcome"

export async function getHasSeenWelcome(): Promise<boolean> {
  const value = await SecureStore.getItemAsync(WELCOME_SEEN_KEY)
  return value === "true"
}

export async function setHasSeenWelcome(): Promise<void> {
  await SecureStore.setItemAsync(WELCOME_SEEN_KEY, "true")
}

export async function clearHasSeenWelcome(): Promise<void> {
  await SecureStore.deleteItemAsync(WELCOME_SEEN_KEY)
}
