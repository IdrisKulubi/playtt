import { type Href, router, useFocusEffect } from "expo-router"
import { useCallback, useRef, useState } from "react"
import { Alert, RefreshControl } from "react-native"

import { MeProfileCard } from "@/components/account/me-profile-card"
import { EmptyState } from "@/components/kit/empty-state"
import { ListRow } from "@/components/kit/list-row"
import { ListSection } from "@/components/kit/list-section"
import { Screen } from "@/components/kit/screen"
import { AccountHubSkeleton } from "@/components/ui/skeleton"
import { useAppTheme } from "@/hooks/use-app-theme"
import { useSkeletonSurface } from "@/hooks/use-product-theme"
import { setProfileSummary } from "@/hooks/use-profile-summary"
import { canChangePassword, formatPersonalDetailsPreview } from "@/lib/account-utils"
import { clearSession } from "@/lib/auth-helpers"
import { goToWelcome } from "@/lib/auth-navigation"
import { fetchCurrentUser, type UserProfile } from "@/lib/user-api"

const PLAY_HREF = "/(app)/(tabs)" as Href

/** Me — opened from your photo on any tab. Job: my details and app settings in one place. */
export default function MeScreen() {
  const { colors } = useAppTheme()
  const skeletonSurface = useSkeletonSurface()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isSigningOut, setIsSigningOut] = useState(false)
  const hasLoadedRef = useRef(false)

  const loadProfile = useCallback(async (silent = false) => {
    if (silent) setIsRefreshing(true)

    try {
      const response = await fetchCurrentUser()
      const user = response.data?.user ?? null
      setProfile(user)
      // Keep the photo in every tab's header up to date.
      if (user) setProfileSummary({ id: user.id, name: user.name, image: user.image ?? null })
    } catch {
      if (!silent) setProfile(null)
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [])

  useFocusEffect(
    useCallback(() => {
      void loadProfile(hasLoadedRef.current)
      hasLoadedRef.current = true
    }, [loadProfile]),
  )

  function goToVerifyEmail() {
    if (!profile?.email) return
    router.push({ pathname: "/(app)/account/verify-email", params: { email: profile.email } })
  }

  // Signing back in costs real effort for some players, so this one asks first.
  function handleSignOutPress() {
    Alert.alert("Sign out?", "You'll need to sign in again to book.", [
      { text: "Stay signed in", style: "cancel" },
      { text: "Sign out", style: "destructive", onPress: () => void handleSignOut() },
    ])
  }

  async function handleSignOut() {
    setIsSigningOut(true)
    try {
      // Ending the session is enough: the signed-in section sees it and replaces
      // itself with the auth screens (see app/(app)/_layout.tsx). Navigating from
      // here as well made two redirects fight, which looped.
      await clearSession()
    } finally {
      setIsSigningOut(false)
    }
  }

  return (
    <Screen
      title="Me"
      back={{
        label: "Back",
        onPress: () => (router.canGoBack() ? router.back() : router.replace(PLAY_HREF)),
      }}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={() => void loadProfile(true)}
          tintColor={colors.secondaryLabel}
        />
      }
    >
      {isLoading && !profile ? (
        <AccountHubSkeleton surface={skeletonSurface} />
      ) : profile ? (
        <MeProfileCard
          profile={profile}
          onEdit={() => router.push("/(app)/account/edit-profile")}
          onVerifyEmail={goToVerifyEmail}
        />
      ) : (
        <EmptyState
          icon="exclamationmark.triangle.fill"
          title="Couldn't load your account"
          message="Check your connection, then try again."
          action={{ label: "Try again", onPress: () => void loadProfile(false) }}
        />
      )}

      {profile ? (
        <ListSection header="Your account">
          <ListRow
            icon="person.fill"
            title="Personal details"
            subtitle={formatPersonalDetailsPreview(profile)}
            onPress={() => router.push("/(app)/account/edit-profile")}
            accessibilityHint="Edit your name, phone and skill level"
          />
          {canChangePassword(profile.authMethods) ? (
            <ListRow
              icon="lock.fill"
              tone="neutral"
              title="Password"
              subtitle="Change your sign-in password"
              onPress={() => router.push("/(app)/account/change-password")}
            />
          ) : null}
        </ListSection>
      ) : null}

      <ListSection header="Preferences">
        <ListRow
          icon="bell.fill"
          tone="destructive"
          title="Notifications"
          subtitle="Game reminders and booking updates"
          onPress={() => router.push("/(app)/account/notifications")}
        />
        <ListRow
          icon="person.text.rectangle"
          tone="success"
          title="Player card and privacy"
          subtitle="What other players see"
          onPress={() => router.push("/(app)/account/community-profile")}
        />
      </ListSection>

      <ListSection header="Help">
        <ListRow
          icon="questionmark.circle.fill"
          title="Questions and support"
          subtitle="Bookings, entry codes, replays and Coach"
          onPress={() => router.push("/(app)/account/help")}
        />
        <ListRow
          icon="play.circle.fill"
          tone="neutral"
          title="Watch the intro again"
          subtitle="A quick tour of PlayTT"
          onPress={() => goToWelcome(true)}
        />
      </ListSection>

      <ListSection header="Legal">
        <ListRow
          icon="doc.text.fill"
          tone="neutral"
          title="Terms and privacy"
          onPress={() => router.push("/(app)/account/legal")}
        />
      </ListSection>

      {profile ? (
        <ListSection>
          <ListRow
            icon="trash.fill"
            tone="destructive"
            title="Delete account"
            subtitle="Erase your account and personal details"
            destructive
            onPress={() => router.push("/(app)/account/delete-account" as Href)}
          />
          <ListRow
            icon="rectangle.portrait.and.arrow.right"
            tone="destructive"
            title={isSigningOut ? "Signing out…" : "Sign out"}
            destructive
            onPress={isSigningOut ? undefined : handleSignOutPress}
          />
        </ListSection>
      ) : null}
    </Screen>
  )
}
