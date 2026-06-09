import type { AuthMode } from "@/constants/auth-theme"
import { Redirect, useLocalSearchParams } from "expo-router"
import { useEffect, useState } from "react"
import { ActivityIndicator, StyleSheet, View } from "react-native"

import { AuthForm } from "@/components/auth/auth-form"
import { AuthShell } from "@/components/auth/auth-shell"
import { PlayTTColors } from "@/constants/playtt-tokens"
import { useAuthTheme } from "@/hooks/use-auth-theme"
import { useSession } from "@/lib/auth-client"
import { AUTHENTICATED_HOME } from "@/lib/auth-navigation"
import { resolvePostAuthRoute } from "@/lib/user-api"

function parseAuthMode(mode: string | string[] | undefined): AuthMode {
  const value = Array.isArray(mode) ? mode[0] : mode
  return value === "sign-up" ? "sign-up" : "sign-in"
}

export default function IndexScreen() {
  const { data: session, isPending } = useSession()
  const { mode: modeParam } = useLocalSearchParams<{ mode?: string }>()
  const initialMode = parseAuthMode(modeParam)
  const [mode, setMode] = useState<AuthMode>(initialMode)
  const [postAuthRoute, setPostAuthRoute] = useState<string | null>(null)
  const [isResolvingRoute, setIsResolvingRoute] = useState(false)
  const theme = useAuthTheme()

  useEffect(() => {
    let mounted = true

    async function resolveRoute() {
      if (!session) {
        if (mounted) {
          setPostAuthRoute(null)
          setIsResolvingRoute(false)
        }
        return
      }

      setIsResolvingRoute(true)

      try {
        const route = await resolvePostAuthRoute()
        if (mounted) {
          setPostAuthRoute(route)
        }
      } catch {
        if (mounted) {
          setPostAuthRoute(AUTHENTICATED_HOME)
        }
      } finally {
        if (mounted) {
          setIsResolvingRoute(false)
        }
      }
    }

    void resolveRoute()

    return () => {
      mounted = false
    }
  }, [session])

  if (isPending || (session && isResolvingRoute)) {
    return (
      <View style={[styles.loading, { backgroundColor: theme.pageBackground }]}>
        <ActivityIndicator color={PlayTTColors.primary} />
      </View>
    )
  }

  if (session && postAuthRoute) {
    return <Redirect href={postAuthRoute as never} />
  }

  const subtitle =
    mode === "sign-in" ? "Sign in to PlayTT" : "Create your PlayTT account"

  return (
    <AuthShell subtitle={subtitle}>
      <AuthForm initialMode={initialMode} onModeChange={setMode} />
    </AuthShell>
  )
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
})
