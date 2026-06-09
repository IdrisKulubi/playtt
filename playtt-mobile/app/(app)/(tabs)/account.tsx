import { router, useFocusEffect } from "expo-router"
import { useCallback, useState } from "react"
import { ScrollView, StyleSheet, Text, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"

import { AccountProfileHeader } from "@/components/account/account-profile-header"
import { AccountRow } from "@/components/account/account-row"
import { AccountSection } from "@/components/account/account-section"
import { Button } from "@/components/ui/button"
import {
  AccountHubSkeleton,
  SkeletonGate,
} from "@/components/ui/skeleton"
import {
  PlayTTColors,
  PlayTTFontFamilies,
  PlayTTSpacing,
  PlayTTTypography,
} from "@/constants/playtt-tokens"
import {
  canChangePassword,
  formatPersonalDetailsPreview,
  getOAuthProviderLabel,
} from "@/lib/account-utils"
import { clearSession } from "@/lib/auth-helpers"
import { fetchCurrentUser, type UserProfile } from "@/lib/user-api"

export default function AccountScreen() {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSigningOut, setIsSigningOut] = useState(false)

  const loadProfile = useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await fetchCurrentUser()
      setProfile(response.data?.user ?? null)
    } catch {
      setProfile(null)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useFocusEffect(
    useCallback(() => {
      void loadProfile()
    }, [loadProfile]),
  )

  function goToVerifyEmail() {
    if (!profile?.email) {
      return
    }

    router.push({
      pathname: "/(app)/account/verify-email",
      params: { email: profile.email },
    })
  }

  async function handleSignOut() {
    setIsSigningOut(true)
    await clearSession()
    router.replace("/?mode=sign-in")
    setIsSigningOut(false)
  }

  const oauthLabel = getOAuthProviderLabel(profile?.authMethods)
  const showChangePassword = canChangePassword(profile?.authMethods)

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <SkeletonGate
          loading={isLoading}
          skeleton={<AccountHubSkeleton surface="dark" />}
        >
          {profile ? (
            <>
              <Text style={styles.title}>Account</Text>

              <AccountProfileHeader
                profile={profile}
                onVerifyPress={
                  profile.emailVerified ? undefined : goToVerifyEmail
                }
              />

              <AccountSection title="Your details">
                <AccountRow
                  title="Personal details"
                  subtitle={formatPersonalDetailsPreview(profile)}
                  onPress={() => router.push("/(app)/account/edit-profile")}
                  isLast
                />
              </AccountSection>

              <AccountSection title="Security">
                <AccountRow
                  title="Email"
                  value={profile.email}
                  subtitle={
                    profile.emailVerified ? "Verified" : "Verification required"
                  }
                  onPress={profile.emailVerified ? undefined : goToVerifyEmail}
                  showChevron={!profile.emailVerified}
                />
                {showChangePassword ? (
                  <AccountRow
                    title="Change password"
                    subtitle="Update your sign-in password"
                    onPress={() => router.push("/(app)/account/change-password")}
                    isLast
                  />
                ) : oauthLabel ? (
                  <AccountRow title={oauthLabel} isLast showChevron={false} />
                ) : (
                  <AccountRow
                    title="Password"
                    subtitle="Managed by your sign-in provider"
                    isLast
                    showChevron={false}
                  />
                )}
              </AccountSection>

              <Button
                label="Sign out"
                variant="outline"
                surface="product"
                onPress={handleSignOut}
                loading={isSigningOut}
              />
            </>
          ) : (
            <View style={styles.empty}>
              <Text style={styles.title}>Account</Text>
              <Text style={styles.emptyBody}>
                Could not load your account. Pull to refresh or try again later.
              </Text>
            </View>
          )}
        </SkeletonGate>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: PlayTTColors.background,
  },
  scroll: {
    paddingHorizontal: PlayTTSpacing.xl,
    paddingTop: PlayTTSpacing.lg,
    paddingBottom: PlayTTSpacing["2xl"],
    gap: PlayTTSpacing.lg,
  },
  title: {
    ...PlayTTTypography.headline,
    fontFamily: PlayTTFontFamilies.semiBold,
    color: PlayTTColors.foreground,
  },
  empty: {
    gap: PlayTTSpacing.sm,
  },
  emptyBody: {
    fontSize: 14,
    fontFamily: PlayTTFontFamilies.regular,
    color: PlayTTColors.mutedText,
  },
})
