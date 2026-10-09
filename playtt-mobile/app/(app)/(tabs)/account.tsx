import { router, useFocusEffect, useLocalSearchParams } from "expo-router"
import { useCallback, useMemo, useRef, useState } from "react"
import { Alert, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"

import { AccountProfilePanel } from "@/components/account/account-profile-panel"
import { AccountSettingsPanel } from "@/components/account/account-settings-panel"
import { createAppScreenStyles } from "@/components/layout/app-screen-styles"
import type { AccountTab } from "@/components/navigation/account-subnav"
import { GlassSegmentControl } from "@/components/ui/glass-segment-control"
import { PlayTTSpacing } from "@/constants/playtt-tokens"
import { clearSession } from "@/lib/auth-helpers"
import { goToSignIn } from "@/lib/auth-navigation"
import { fetchCurrentUser, type UserProfile } from "@/lib/user-api"
import { useProductTheme } from "@/hooks/use-product-theme"

function parseAccountTab(value: string | string[] | undefined): AccountTab {
  const raw = Array.isArray(value) ? value[0] : value
  return raw === "settings" ? "settings" : "account"
}

export default function AccountScreen() {
  const theme = useProductTheme()
  const styles = useMemo(() => createAppScreenStyles(theme), [theme])
  const { accountTab: accountTabParam } = useLocalSearchParams<{
    accountTab?: string
  }>()
  const [accountTab, setAccountTab] = useState<AccountTab>(() =>
    parseAccountTab(accountTabParam),
  )

  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [hasFetchedProfile, setHasFetchedProfile] = useState(false)
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
        setHasFetchedProfile(true)
      }
      setIsRefreshing(false)
    }
  }, [])

  function handleAccountTabChange(tab: AccountTab) {
    setAccountTab(tab)
    if (tab === "account" && !hasFetchedProfile) {
      void loadProfile(false)
    }
  }

  useFocusEffect(
    useCallback(() => {
      if (accountTab === "account") {
        void loadProfile(hasLoadedRef.current)
        hasLoadedRef.current = true
      }
    }, [accountTab, loadProfile]),
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
    goToSignIn()
    setIsSigningOut(false)
  }

  const hubPadding = useMemo(
    () => ({
      paddingHorizontal: 20,
      paddingTop: PlayTTSpacing.sm,
      gap: PlayTTSpacing.md,
    }),
    [],
  )

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <View style={hubPadding}>
        <GlassSegmentControl
          value={accountTab}
          options={[
            { value: "account", label: "Profile" },
            { value: "settings", label: "Settings" },
          ]}
          onChange={handleAccountTabChange}
        />
      </View>

      <View style={{ flex: 1 }}>
        {accountTab === "account" ? (
          <AccountProfilePanel
            profile={profile}
            isLoading={isLoading || !hasFetchedProfile}
            isRefreshing={isRefreshing}
            isSigningOut={isSigningOut}
            onRefresh={() => void loadProfile(true)}
            onRetry={() => void loadProfile(false)}
            onVerifyEmail={goToVerifyEmail}
            onSignOutPress={handleSignOutPress}
          />
        ) : (
          <AccountSettingsPanel />
        )}
      </View>
    </SafeAreaView>
  )
}
