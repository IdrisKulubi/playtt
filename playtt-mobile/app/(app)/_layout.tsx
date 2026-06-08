import { Redirect, Stack } from "expo-router"
import { ActivityIndicator, StyleSheet, View } from "react-native"
import { useEffect, useState } from "react"

import { PlayTTColors } from "@/constants/playtt-tokens"
import { getStoredAuth } from "@/lib/auth-helpers"

export default function AppLayout() {
  const [hasStoredAuth, setHasStoredAuth] = useState<boolean | null>(null)

  useEffect(() => {
    let mounted = true

    getStoredAuth().then((stored) => {
      if (mounted) {
        setHasStoredAuth(Boolean(stored?.token))
      }
    })

    return () => {
      mounted = false
    }
  }, [])

  if (hasStoredAuth === null) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={PlayTTColors.primary} />
      </View>
    )
  }

  if (!hasStoredAuth) {
    return <Redirect href="/auth?mode=sign-in" />
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
