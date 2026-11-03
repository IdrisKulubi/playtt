import { useEffect, useSyncExternalStore } from "react"

import { fetchCurrentUser } from "@/lib/user-api"

/** Just enough of the signed-in player for headers: who, their name and photo. */
export type ProfileSummary = { id: string; name: string; image: string | null }

let summary: ProfileSummary | null = null
let loading: Promise<void> | null = null
const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

/** Share fresh profile data (Me loads it, the photo picker changes it). */
export function setProfileSummary(next: ProfileSummary | null) {
  summary = next
  emit()
}

export function updateProfileSummary(patch: Partial<ProfileSummary>) {
  if (!summary) return
  setProfileSummary({ ...summary, ...patch })
}

function loadOnce() {
  if (summary || loading) return
  loading = fetchCurrentUser()
    .then((response) => {
      const user = response.data?.user
      if (user) setProfileSummary({ id: user.id, name: user.name, image: user.image ?? null })
    })
    .catch(() => undefined)
    .finally(() => {
      loading = null
    })
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/**
 * The signed-in player's name and photo, fetched once and shared by every
 * screen header, so switching tabs never refetches or flickers.
 */
export function useProfileSummary() {
  const value = useSyncExternalStore(subscribe, () => summary)

  useEffect(() => {
    loadOnce()
  }, [])

  return value
}
