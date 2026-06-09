import { router } from "expo-router"
import { useEffect } from "react"

import { setSessionExpiredHandler } from "@/lib/api-client"
import { clearSession } from "@/lib/auth-helpers"
import { toast } from "@/lib/toast"

export function SessionBootstrap() {
  useEffect(() => {
    setSessionExpiredHandler(async () => {
      await clearSession()
      toast.info("Your session expired. Please sign in again.")
      router.replace("/?mode=sign-in")
    })
  }, [])

  return null
}
