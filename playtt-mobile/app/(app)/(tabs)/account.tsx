import { router, useFocusEffect } from "expo-router"
import { useCallback, useMemo, useRef, useState } from "react"
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"

import { AccountProfileHeader } from "@/components/account/account-profile-header"
import { AccountRow } from "@/components/account/account-row"
import { AccountSection } from "@/components/account/account-section"
import { createAppScreenStyles } from "@/components/layout/app-screen-styles"
import { Button } from "@/components/ui/button"
import {
  AccountHubSkeleton,
  SkeletonGate,
} from "@/components/ui/skeleton"
import { PlayTTColors, PlayTTFontFamilies } from "@/constants/playtt-tokens"
import {
  canChangePassword,
  formatPersonalDetailsPreview,
  getOAuthProviderLabel,
} from "@/lib/account-utils"
import { clearSession } from "@/lib/auth-helpers"
import { fetchCurrentUser, type UserProfile } from "@/lib/user-api"
import {
  useProductTheme,
  useSkeletonSurface,
} from "@/hooks/use-product-theme"

export default function AccountScreen() {
  const theme = useProductTheme()
  const skeletonSurface = useSkeletonSurface()
  const styles = useMemo(() => createAppScreenStyles(theme), [theme])

  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isSigningOut, setIsSigningOut] = useState(false)
  const hasLoadedRef = useRef(false)

  const loadProfile = useCallback(async (silent = false) => {
    if (silent) {
      setIsRefreshing(true)
    } else {
      setIsLoading(true)
    }

    try {
      const response = await fetchCurrentUser()
      setProfile(response.data?.user ?? null)
    } catch {
      if (!silent) {
        setProfile(null)
      }
    } finally {
      if (!silent) {
        setIsLoading(false)
      }
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
    if (!profile?.email) {
      return
    }

    router.push({
      pathname: "/(app)/account/verify-email",
      params: { email: profile.email },
    })
  }

  function handleSignOutPress() {
    Alert.alert(
      "Sign out?",
      "You will need to sign in again to book.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign out",
          style: "destructive",
          onPress: () => void handleSignOut(),
        },
      ],
    )
  }

  async function handleSignOut() {
    setIsSigningOut(true)
    await clearSession()
    router.replace("/?mode=sign-in")
    setIsSigningOut(false)
  }

  const oauthLabel = getOAuthProviderLabel(profile?.authMethods)
  const showChangePassword = canChangePassword(profile?.authMethods)
  const showSecuritySection = showChangePassword || Boolean(oauthLabel)

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.accountScroll}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => void loadProfile(true)}
            tintColor={PlayTTColors.primary}
          />
        }
      >
        <SkeletonGate
          loading={isLoading && !profile}
          skeleton={<AccountHubSkeleton surface={skeletonSurface} />}
        >
          {profile ? (
            <>
              <AccountProfileHeader
                profile={profile}
                onVerifyPress={
                  profile.emailVerified ? undefined : goToVerifyEmail
                }
              />

              <AccountSection title="Profile">
                <AccountRow
                  title="Personal details"
                  subtitle={formatPersonalDetailsPreview(profile)}
                  onPress={() => router.push("/(app)/account/edit-profile")}
                  accessibilityHint="Edit your name, phone, and skill level"
                  isLast
                />
              </AccountSection>

              {showSecuritySection ? (
                <AccountSection
                  title="Security"
                  description={
                    !showChangePassword && oauthLabel ? oauthLabel : undefined
                  }
                >
                  {showChangePassword ? (
                    <AccountRow
                      title="Change password"
                      subtitle="Update your sign-in password"
                      onPress={() =>
                        router.push("/(app)/account/change-password")
                      }
                      accessibilityHint="Opens the change password screen"
                      isLast
                    />
                  ) : null}
                </AccountSection>
              ) : null}

              <AccountSection title="Settings">
                <AccountRow
                  title="Coach"
                  subtitle="Subscription and clip packs"
                  onPress={() => router.push("/(app)/(tabs)/coach")}
                />
                <AccountRow
                  title="Notifications"
                  subtitle="Reminders and booking updates"
                  onPress={() => router.push("/(app)/account/notifications")}
                />
                <AccountRow
                  title="Help"
                  subtitle="FAQs and support"
                  onPress={() => router.push("/(app)/account/help")}
                />
                <AccountRow
                  title="Legal"
                  subtitle="Terms and privacy"
                  onPress={() => router.push("/(app)/account/legal")}
                  isLast
                />
              </AccountSection>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Sign out"
                accessibilityState={{ disabled: isSigningOut }}
                disabled={isSigningOut}
                onPress={handleSignOutPress}
                style={styles.signOut}
              >
                <Text style={styles.signOutLabel}>
                  {isSigningOut ? "Signing out…" : "Sign out"}
                </Text>
              </Pressable>
            </>
          ) : (
            <View style={styles.empty}>
              <Text style={[localStyles.emptyTitle, { color: theme.foreground }]}>
                Could not load your account.
              </Text>
              <Button
                label="Try again"
                surface="product"
                onPress={() => void loadProfile(false)}
              />
            </View>
          )}
        </SkeletonGate>
      </ScrollView>
    </SafeAreaView>
  )
}

const localStyles = StyleSheet.create({
  emptyTitle: {
    fontSize: 16,
    fontFamily: PlayTTFontFamilies.medium,
  },
})
