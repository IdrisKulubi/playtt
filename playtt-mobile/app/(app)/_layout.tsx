import { Redirect, Stack, useFocusEffect } from "expo-router"
import { useCallback, useEffect, useState } from "react"

import { useSplashHold } from "@/hooks/use-splash-hold"
import { getStoredAuth } from "@/lib/auth-helpers"
import { isTransientApiError } from "@/lib/api-errors"
import { ONBOARDING_ROUTE } from "@/lib/auth-navigation"
import { onSessionSignedOut } from "@/lib/auth-session-state"
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
      if (!(await getStoredAuth())?.token) {
        setGate("auth")
        return
      }

      if (!response.data?.user?.onboardingCompletedAt) {
        setGate("onboarding")
        return
      }

      setGate("app")
    } catch (error) {
      const currentAuth = await getStoredAuth()
      setGate(isTransientApiError(error) && currentAuth?.token ? "app" : "auth")
    }
  }, [])

  useEffect(() => {
    void resolveGate()
  }, [resolveGate])

  // Nobody stays in the app without a session: the moment it ends (sign out, delete,
  // expiry), whatever screen is open gives way to the auth screens.
  useEffect(() => onSessionSignedOut(() => setGate("auth")), [])

  useFocusEffect(
    useCallback(() => {
      void resolveGate()
    }, [resolveGate]),
  )

  const holdSplash = gate === "loading" || gate === "auth" || gate === "onboarding"
  useSplashHold(holdSplash, "app-auth-gate")

  if (gate === "loading" || gate === "auth" || gate === "onboarding") {
    if (gate === "auth") {
      // No mode here: a first-time visitor sees the intro, a returning one lands on sign in.
      return <Redirect href="/" />
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
      <Stack.Screen name="kit-demo" />
      <Stack.Screen name="booking/[id]/index" />
      <Stack.Screen name="booking/[id]/edit" />
      <Stack.Screen name="account/index" />
      <Stack.Screen name="account/edit-profile" />
      <Stack.Screen name="account/change-password" />
      <Stack.Screen name="account/verify-email" />
      <Stack.Screen name="account/notifications" />
      <Stack.Screen name="account/community-profile" />
      <Stack.Screen name="account/help" />
      <Stack.Screen name="account/legal" />
      <Stack.Screen name="coach/index" />
      <Stack.Screen name="progress/replays" />
      <Stack.Screen name="progress/stats" />
      <Stack.Screen name="coach/buy-replays" />
      <Stack.Screen name="coach/subscribe" />
      <Stack.Screen name="community/player/[userId]/index" />
      <Stack.Screen name="community/player/[userId]/connections" />
      <Stack.Screen name="community/inbox" />
      <Stack.Screen name="community/chat/[conversationId]" />
      <Stack.Screen name="community/group/[groupId]" />
    </Stack>
  )
}
