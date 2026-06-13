import type { AuthMode } from "@/constants/auth-theme"
import { Redirect, router, useLocalSearchParams } from "expo-router"
import { useEffect, useRef, useState } from "react"
import { AuthForm } from "@/components/auth/auth-form"
import { AuthShell } from "@/components/auth/auth-shell"
import { AuthFormSkeleton } from "@/components/ui/skeleton"
import { useSession } from "@/lib/auth-client"
import { authDebug, authDebugError } from "@/lib/auth-debug"
import { getStoredAuth, waitForStoredAuth } from "@/lib/auth-helpers"
import { toast } from "@/lib/toast"
import { resolvePostAuthRoute } from "@/lib/user-api"
import { getHasSeenWelcome } from "@/lib/welcome-storage"

function parseAuthMode(mode: string | string[] | undefined): AuthMode {
  const value = Array.isArray(mode) ? mode[0] : mode
  return value === "sign-up" ? "sign-up" : "sign-in"
}

export default function IndexScreen() {
  const { data: session, isPending } = useSession()
  const { mode: modeParam } = useLocalSearchParams<{ mode?: string }>()
  const initialMode = parseAuthMode(modeParam)
  const [mode, setMode] = useState<AuthMode>(initialMode)
  const [isResolvingRoute, setIsResolvingRoute] = useState(false)
  const [welcomeChecked, setWelcomeChecked] = useState(false)
  const [hasSeenWelcome, setHasSeenWelcomeState] = useState(true)
  const [isRedirecting, setIsRedirecting] = useState(false)
  const didNavigateRef = useRef(false)
  const isResolvingRef = useRef(false)

  useEffect(() => {
    let mounted = true

    async function checkWelcome() {
      const stored = await getStoredAuth()
      if (stored?.token) {
        if (mounted) {
          setWelcomeChecked(true)
        }
        return
      }

      const seen = await getHasSeenWelcome()
      if (mounted) {
        setHasSeenWelcomeState(seen)
        setWelcomeChecked(true)
      }
    }

    void checkWelcome()

    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    if (isPending || isResolvingRef.current || didNavigateRef.current) {
      return
    }

    let mounted = true
    isResolvingRef.current = true

    async function resolveRoute() {
      const stored = session ? await waitForStoredAuth() : await getStoredAuth()

      authDebug("index:resolve-route", {
        hasBetterAuthSession: Boolean(session),
        storedAuthFound: Boolean(stored?.token),
        storedAuthSource: stored?.source,
      })

      if (!stored?.token) {
        if (mounted) {
          setIsResolvingRoute(false)
        }
        isResolvingRef.current = false
        return
      }

      if (mounted) {
        setIsResolvingRoute(true)
      }

      try {
        const route = await resolvePostAuthRoute()
        authDebug("index:resolve-route-success", { route })

        if (!mounted || didNavigateRef.current) {
          return
        }

        didNavigateRef.current = true
        setIsRedirecting(true)
        router.replace(route as never)
      } catch (error) {
        authDebugError("index:resolve-route-failed", error)
        if (mounted) {
          toast.apiError(error, "Could not load your account. Try again.")
        }
        didNavigateRef.current = false
      } finally {
        if (mounted) {
          setIsResolvingRoute(false)
        }
        isResolvingRef.current = false
      }
    }

    void resolveRoute()

    return () => {
      mounted = false
    }
  }, [session, isPending])

  const isBootstrapping =
    isPending ||
    isResolvingRoute ||
    isRedirecting ||
    !welcomeChecked

  if (isBootstrapping) {
    return (
      <AuthShell subtitle={mode === "sign-in" ? "Sign in to PlayTT" : "Create your PlayTT account"}>
        <AuthFormSkeleton surface="product" />
      </AuthShell>
    )
  }

  if (!hasSeenWelcome) {
    return <Redirect href="/welcome" />
  }

  const subtitle =
    mode === "sign-in" ? "Sign in to PlayTT" : "Create your PlayTT account"

  return (
    <AuthShell subtitle={subtitle}>
      <AuthForm initialMode={initialMode} onModeChange={setMode} />
    </AuthShell>
  )
}
