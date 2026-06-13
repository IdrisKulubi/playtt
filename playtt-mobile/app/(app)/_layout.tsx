import { Redirect, Stack, useFocusEffect } from "expo-router"
import { useCallback, useEffect, useMemo, useState } from "react"
import { View } from "react-native"

import { createAppScreenStyles } from "@/components/layout/app-screen-styles"
import { AuthFormSkeleton } from "@/components/ui/skeleton"
import { useProductTheme, useSkeletonSurface } from "@/hooks/use-product-theme"
import { getStoredAuth } from "@/lib/auth-helpers"
import { ONBOARDING_ROUTE } from "@/lib/auth-navigation"
import { fetchCurrentUser } from "@/lib/user-api"

export default function AppLayout() {
  const theme = useProductTheme()
  const skeletonSurface = useSkeletonSurface()
  const styles = useMemo(() => createAppScreenStyles(theme), [theme])

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

  if (gate === "loading") {
    return (
      <View style={styles.loadingGate}>
        <AuthFormSkeleton surface={skeletonSurface} />
      </View>
    )
  }

  if (gate === "auth") {
    return <Redirect href="/?mode=sign-in" />
  }

  if (gate === "onboarding") {
    return <Redirect href={ONBOARDING_ROUTE} />
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
