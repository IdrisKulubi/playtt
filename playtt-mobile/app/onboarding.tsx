import { Redirect } from "expo-router"
import { useEffect, useState } from "react"
import { ActivityIndicator, StyleSheet, View } from "react-native"

import { AuthShell } from "@/components/auth/auth-shell"
import { OnboardingProfileForm } from "@/components/onboarding/onboarding-profile-form"
import { OnboardingSurveyForm } from "@/components/onboarding/onboarding-survey-form"
import { PlayTTColors } from "@/constants/playtt-tokens"
import { useAuthTheme } from "@/hooks/use-auth-theme"
import { useSession } from "@/lib/auth-client"
import { AUTHENTICATED_HOME } from "@/lib/auth-navigation"
import { fetchCurrentUser, type UserProfile } from "@/lib/user-api"

export default function OnboardingScreen() {
  const { data: session, isPending } = useSession()
  const theme = useAuthTheme()
  const [step, setStep] = useState<1 | 2>(1)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [isLoadingProfile, setIsLoadingProfile] = useState(true)

  useEffect(() => {
    let mounted = true

    async function loadProfile() {
      if (!session) {
        if (mounted) {
          setIsLoadingProfile(false)
        }
        return
      }

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
  }, [session])

  if (isPending || isLoadingProfile) {
    return (
      <View style={[styles.loading, { backgroundColor: theme.pageBackground }]}>
        <ActivityIndicator color={PlayTTColors.primary} />
      </View>
    )
  }

  if (!session) {
    return <Redirect href="/?mode=sign-in" />
  }

  if (profile?.onboardingCompletedAt) {
    return <Redirect href={AUTHENTICATED_HOME} />
  }

  if (step === 1) {
    return (
      <AuthShell
        headline="Set up your player profile"
        subtitle="We use this to personalize bookings and venue updates."
      >
        <OnboardingProfileForm
          initialName={profile?.name ?? session.user.name ?? ""}
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

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
})
