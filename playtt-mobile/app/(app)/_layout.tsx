import { Redirect, Stack } from "expo-router"
import { ActivityIndicator, StyleSheet, View } from "react-native"
import { useEffect, useState } from "react"

import { PlayTTColors } from "@/constants/playtt-tokens"
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
        <ActivityIndicator color={PlayTTColors.primary} />
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
    </Stack>
  )
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: PlayTTColors.background,
  },
})
