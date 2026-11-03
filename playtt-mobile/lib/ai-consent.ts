import * as SecureStore from "expo-secure-store"
import { useEffect, useSyncExternalStore } from "react"

/**
 * Permission to send what you type to Coach to a third-party AI service
 * (App Store Guideline 5.1.2(i)). Stored on this phone; "denied" is remembered
 * too, so the question is not asked again until the person changes it in Me.
 */
const KEY = "playtt.aiConsent"

type Consent = "unknown" | "granted" | "denied"

let consent: Consent = "unknown"
let loaded = false
const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

async function load() {
  if (loaded) return
  loaded = true
  try {
    const stored = await SecureStore.getItemAsync(KEY)
    if (stored === "granted" || stored === "denied") {
      consent = stored
      emit()
    }
  } catch {
    // No storage here: ask again next time.
  }
}

export async function setAiConsent(next: Exclude<Consent, "unknown">) {
  consent = next
  emit()
  try {
    await SecureStore.setItemAsync(KEY, next)
  } catch {
    // Kept for this session only.
  }
}

/** Forget the answer (sign-out): the next person is asked for themselves. */
export async function resetAiConsent() {
  consent = "unknown"
  loaded = false
  emit()
  try {
    await SecureStore.deleteItemAsync(KEY)
  } catch {
    // Nothing stored.
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useAiConsent() {
  const value = useSyncExternalStore(subscribe, () => consent)
  useEffect(() => {
    void load()
  }, [])
  return value
}
