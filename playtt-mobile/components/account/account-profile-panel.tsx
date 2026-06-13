import { router } from "expo-router"
import { useMemo } from "react"
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native"

import { AccountProfileHeader } from "@/components/account/account-profile-header"
import { AccountRow } from "@/components/account/account-row"
import { AccountSection } from "@/components/account/account-section"
import { createAppScreenStyles } from "@/components/layout/app-screen-styles"
import { Button } from "@/components/ui/button"
import {
  AccountHubSkeleton,
  SkeletonGate,
} from "@/components/ui/skeleton"
import { FLOATING_TAB_BAR_CLEARANCE } from "@/constants/navigation-layout"
import { PlayTTColors, PlayTTFontFamilies } from "@/constants/playtt-tokens"
import {
  canChangePassword,
  formatPersonalDetailsPreview,
  getOAuthProviderLabel,
} from "@/lib/account-utils"
import type { UserProfile } from "@/lib/user-api"
import { useProductTheme, useSkeletonSurface } from "@/hooks/use-product-theme"

type AccountProfilePanelProps = {
  profile: UserProfile | null
  isLoading: boolean
  isRefreshing: boolean
  isSigningOut: boolean
  onRefresh: () => void
  onRetry: () => void
  onVerifyEmail: () => void
  onSignOutPress: () => void
}

export function AccountProfilePanel({
  profile,
  isLoading,
  isRefreshing,
  isSigningOut,
  onRefresh,
  onRetry,
  onVerifyEmail,
  onSignOutPress,
}: AccountProfilePanelProps) {
  const theme = useProductTheme()
  const skeletonSurface = useSkeletonSurface()
  const styles = useMemo(() => createAppScreenStyles(theme), [theme])

  const oauthLabel = getOAuthProviderLabel(profile?.authMethods)
  const showChangePassword = canChangePassword(profile?.authMethods)
  const showSecuritySection = showChangePassword || Boolean(oauthLabel)

  return (
    <ScrollView
      contentContainerStyle={[
        styles.accountScroll,
        { paddingBottom: FLOATING_TAB_BAR_CLEARANCE },
      ]}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={onRefresh}
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
                profile.emailVerified ? undefined : onVerifyEmail
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

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Sign out"
              accessibilityState={{ disabled: isSigningOut }}
              disabled={isSigningOut}
              onPress={onSignOutPress}
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
              onPress={onRetry}
            />
          </View>
        )}
      </SkeletonGate>
    </ScrollView>
  )
}

const localStyles = StyleSheet.create({
  emptyTitle: {
    fontSize: 16,
    fontFamily: PlayTTFontFamilies.medium,
  },
})
