import type { AuthMode } from "@/constants/auth-theme"
import { Redirect, useLocalSearchParams } from "expo-router"
import { useEffect, useState } from "react"
import { AuthForm } from "@/components/auth/auth-form"
import { AuthShell } from "@/components/auth/auth-shell"
import { AuthFormSkeleton } from "@/components/ui/skeleton"
import { useSession } from "@/lib/auth-client"
import { waitForStoredAuth } from "@/lib/auth-helpers"
import { toast } from "@/lib/toast"
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
        const stored = await waitForStoredAuth()
        if (!stored?.token) {
          if (mounted) {
            setPostAuthRoute(null)
          }
          return
        }

        const route = await resolvePostAuthRoute()
        if (mounted) {
          setPostAuthRoute(route)
        }
      } catch (error) {
        if (mounted) {
          toast.apiError(error, "Could not load your account. Try again.")
          setPostAuthRoute(null)
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
      <AuthShell subtitle={mode === "sign-in" ? "Sign in to PlayTT" : "Create your PlayTT account"}>
        <AuthFormSkeleton surface="product" />
      </AuthShell>
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

