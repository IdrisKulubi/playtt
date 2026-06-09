import { Redirect, Stack } from "expo-router"
import { StyleSheet, View } from "react-native"
import { useEffect, useState } from "react"

import { AuthFormSkeleton } from "@/components/ui/skeleton"
import { PlayTTColors, PlayTTSpacing } from "@/constants/playtt-tokens"
import { getStoredAuth } from "@/lib/auth-helpers"
import { ONBOARDING_ROUTE } from "@/lib/auth-navigation"
import { fetchCurrentUser } from "@/lib/user-api"

export default function AppLayout() {
  const [gate, setGate] = useState<"loading" | "auth" | "onboarding" | "app">(
    "loading",
  )

  useEffect(() => {
    let mounted = true

    async function resolveGate() {
      const stored = await getStoredAuth()

      if (!stored?.token) {
        if (mounted) {
          setGate("auth")
        }
        return
      }

      try {
        const response = await fetchCurrentUser()
        if (!mounted) {
          return
        }

        if (!response.data?.user?.onboardingCompletedAt) {
          setGate("onboarding")
          return
        }

        setGate("app")
      } catch {
        if (mounted) {
          setGate("app")
        }
      }
    }

    void resolveGate()

    return () => {
      mounted = false
    }
  }, [])

  if (gate === "loading") {
    return (
      <View style={styles.loading}>
        <AuthFormSkeleton surface="dark" />
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
      <Stack.Screen name="booking/[id]" />
      <Stack.Screen name="account/edit-profile" />
      <Stack.Screen name="account/change-password" />
      <Stack.Screen name="account/verify-email" />
    </Stack>
  )
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: PlayTTColors.background,
    paddingTop: PlayTTSpacing.xl,
  },
})
