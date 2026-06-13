import { Redirect, Stack, useFocusEffect } from "expo-router"
import { useCallback, useEffect, useState } from "react"

import { useSplashHold } from "@/hooks/use-splash-hold"
import { getStoredAuth } from "@/lib/auth-helpers"
import { ONBOARDING_ROUTE } from "@/lib/auth-navigation"
import { fetchCurrentUser } from "@/lib/user-api"

export default function AppLayout() {
  const [gate, setGate] = useState<"loading" | "auth" | "onboarding" | "app">(
    "loading",
  )

  const resolveGate = useCallback(async () => {
    const stored = await getStoredAuth()

    if (!stored?.token) {
      setGate("auth")
      return
    }

    try {
      const response = await fetchCurrentUser()

      if (!response.data?.user?.onboardingCompletedAt) {
        setGate("onboarding")
        return
      }

      setGate("app")
    } catch {
      setGate("app")
    }
  }, [])

  useEffect(() => {
    void resolveGate()
  }, [resolveGate])

  useFocusEffect(
    useCallback(() => {
      async function checkStoredAuth() {
        const stored = await getStoredAuth()
        if (!stored?.token) {
          setGate("auth")
        }
      }

      void checkStoredAuth()
    }, []),
  )

  const holdSplash = gate === "loading" || gate === "auth" || gate === "onboarding"
  useSplashHold(holdSplash, "app-auth-gate")

  if (gate === "loading" || gate === "auth" || gate === "onboarding") {
    if (gate === "auth") {
      return <Redirect href="/?mode=sign-in" />
    }

    if (gate === "onboarding") {
      return <Redirect href={ONBOARDING_ROUTE} />
    }

    return null
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="book" />
      <Stack.Screen name="booking/[id]/index" />
      <Stack.Screen name="booking/[id]/edit" />
      <Stack.Screen name="account/edit-profile" />
      <Stack.Screen name="account/change-password" />
      <Stack.Screen name="account/verify-email" />
      <Stack.Screen name="account/notifications" />
      <Stack.Screen name="account/help" />
      <Stack.Screen name="account/legal" />
      <Stack.Screen name="coach/buy-replays" />
      <Stack.Screen name="coach/subscribe" />
    </Stack>
  )
}
