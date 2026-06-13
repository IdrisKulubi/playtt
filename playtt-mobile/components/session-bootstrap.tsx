import { router } from "expo-router"
import { useEffect } from "react"

import { setSessionExpiredHandler } from "@/lib/api-client"
import { authDebug } from "@/lib/auth-debug"
import { clearSession } from "@/lib/auth-helpers"
import { toast } from "@/lib/toast"

export function SessionBootstrap() {
  useEffect(() => {
    setSessionExpiredHandler(async () => {
      authDebug("session-expired-handler:triggered")
      await clearSession()
      toast.info("Your session expired. Please sign in again.")
      authDebug("session-expired-handler:redirect-sign-in")
      router.replace("/?mode=sign-in")
    })
  }, [])

  return null
}
