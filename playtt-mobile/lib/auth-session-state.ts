import * as SecureStore from "expo-secure-store"

const SIGNED_OUT_KEY = "playtt_signed_out"
let revision = 0
let signedOut = false

const signedOutListeners = new Set<() => void>()

/** Told the moment the session ends, so signed-in screens can leave at once. */
export function onSessionSignedOut(listener: () => void) {
  signedOutListeners.add(listener)
  return () => {
    signedOutListeners.delete(listener)
  }
}

/** Call once the stored sign-in is really gone, never before, or screens bounce back in. */
export function announceSessionSignedOut() {
  for (const listener of signedOutListeners) listener()
}

export function getSessionRevision() {
  return revision
}

export async function isSessionSignedOut() {
  return signedOut || (await SecureStore.getItemAsync(SIGNED_OUT_KEY)) === "1"
}

export async function markSessionSignedOut() {
  signedOut = true
  revision += 1
  await SecureStore.setItemAsync(SIGNED_OUT_KEY, "1")
}

// Call only after authentication succeeds, never when merely opening a form.
export async function acceptAuthenticatedSession() {
  await SecureStore.deleteItemAsync(SIGNED_OUT_KEY)
  signedOut = false
  revision += 1
}
