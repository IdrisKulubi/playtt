import { Redirect } from "expo-router"
import { useEffect, useState } from "react"
import { AuthShell } from "@/components/auth/auth-shell"
import { AuthFormSkeleton } from "@/components/ui/skeleton"
import { OnboardingProfileForm } from "@/components/onboarding/onboarding-profile-form"
import { OnboardingSurveyForm } from "@/components/onboarding/onboarding-survey-form"
import { useSession } from "@/lib/auth-client"
import { getStoredAuth } from "@/lib/auth-helpers"
import { AUTHENTICATED_HOME } from "@/lib/auth-navigation"
import { fetchCurrentUser, type UserProfile } from "@/lib/user-api"

export default function OnboardingScreen() {
  const { data: session, isPending } = useSession()
  const [step, setStep] = useState<1 | 2>(1)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [hasStoredAuth, setHasStoredAuth] = useState<boolean | null>(null)
  const [isLoadingProfile, setIsLoadingProfile] = useState(true)

  const isAuthed = Boolean(session) || hasStoredAuth === true

  useEffect(() => {
    let mounted = true

    async function checkStoredAuth() {
      const stored = await getStoredAuth()
      if (mounted) {
        setHasStoredAuth(Boolean(stored?.token))
      }
    }

    void checkStoredAuth()

    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    let mounted = true

    async function loadProfile() {
      if (isPending || hasStoredAuth === null) {
        return
      }

      const stored = await getStoredAuth()
      if (!session && !stored?.token) {
        if (mounted) {
          setIsLoadingProfile(false)
        }
        return
      }

      setIsLoadingProfile(true)

      try {
        const response = await fetchCurrentUser()
        if (mounted) {
          setProfile(response.data?.user ?? null)
        }
      } catch {
        if (mounted) {
          setProfile(null)
        }
      } finally {
        if (mounted) {
          setIsLoadingProfile(false)
        }
      }
    }

    void loadProfile()

    return () => {
      mounted = false
    }
  }, [session, isPending, hasStoredAuth])

  if (isPending || hasStoredAuth === null || isLoadingProfile) {
    return (
      <AuthShell subtitle="Setting up your account">
        <AuthFormSkeleton surface="product" />
      </AuthShell>
    )
  }

  if (!isAuthed) {
    return <Redirect href="/?mode=sign-in" />
  }

  if (profile?.onboardingCompletedAt) {
    return <Redirect href={AUTHENTICATED_HOME} />
  }

  const initialName =
    profile?.name ?? session?.user.name ?? ""

  if (step === 1) {
    return (
      <AuthShell
        headline="Set up your player profile"
        subtitle="We use this to personalize bookings and venue updates."
      >
        <OnboardingProfileForm
          initialName={initialName}
          onComplete={() => setStep(2)}
        />
      </AuthShell>
    )
  }

  return (
    <AuthShell
      headline="Help us shape PlayTT"
      subtitle="You're among our first players — 30 seconds helps us build the right experience."
    >
      <OnboardingSurveyForm />
    </AuthShell>
  )
}
