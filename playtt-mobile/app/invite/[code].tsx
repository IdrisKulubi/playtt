import { Redirect, useLocalSearchParams } from "expo-router"
import { useEffect, useState } from "react"

import { normalizeInviteCode, savePendingInvite } from "@/lib/community-invite"

/**
 * playtt://invite/CODE (from the web invite page). Lives outside the signed-in
 * group so the code is saved before any sign-in or sign-up redirect; the
 * Community tab accepts it once the player is in.
 */
export default function InviteLinkScreen() {
  const { code } = useLocalSearchParams<{ code: string }>()
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const normalized = normalizeInviteCode(code ?? "")
    const save = normalized ? savePendingInvite(normalized) : Promise.resolve()
    void save.catch(() => undefined).finally(() => setSaved(true))
  }, [code])

  if (!saved) return null
  return <Redirect href="/(app)/(tabs)/community" />
}
