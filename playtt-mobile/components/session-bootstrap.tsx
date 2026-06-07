import { router } from "expo-router"
import { useEffect } from "react"

import { setSessionExpiredHandler } from "@/lib/api-client"
import { clearSession } from "@/lib/auth-helpers"

export function SessionBootstrap() {
  useEffect(() => {
    setSessionExpiredHandler(async () => {
      await clearSession()
      router.replace("/sign-in")
    })
  }, [])

  return null
}
