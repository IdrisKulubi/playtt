import { router } from "expo-router"
import { useMemo } from "react"
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native"
import { User } from "phosphor-react-native/src/icons/User"
import { Lock } from "phosphor-react-native/src/icons/Lock"

import { AccountGlassRow } from "@/components/account/account-glass-row"
import { AccountGlassSection } from "@/components/account/account-glass-section"
import { AccountProfileHero } from "@/components/account/account-profile-hero"
import { createAppScreenStyles } from "@/components/layout/app-screen-styles"
import { AccountSignOutButton } from "@/components/account/account-sign-out-button"
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

  const scrollStyles = useMemo(
    () =>
      StyleSheet.create({
        scroll: {
          paddingHorizontal: 20,
          paddingTop: 8,
          paddingBottom: FLOATING_TAB_BAR_CLEARANCE,
          gap: 20,
        },
        provider: {
          color: theme.muted,
          fontFamily: PlayTTFontFamilies.regular,
          fontSize: 13,
        },
        emptyTitle: {
          fontSize: 16,
          fontFamily: PlayTTFontFamilies.medium,
          color: theme.foreground,
        },
      }),
    [theme],
  )

  return (
    <ScrollView
      contentContainerStyle={scrollStyles.scroll}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={onRefresh}
          tintColor={PlayTTColors.primary}
        />
      }
      showsVerticalScrollIndicator={false}
    >
      <SkeletonGate
        loading={isLoading && !profile}
        skeleton={<AccountHubSkeleton surface={skeletonSurface} />}
      >
        {profile ? (
          <>
            <AccountProfileHero
              profile={profile}
              onVerifyPress={
                profile.emailVerified ? undefined : onVerifyEmail
              }
            />

            <AccountGlassSection title="Your account">
              <AccountGlassRow
                title="Personal details"
                subtitle={formatPersonalDetailsPreview(profile)}
                icon={<User size={20} color={theme.foreground} weight="regular" />}
                onPress={() => router.push("/(app)/account/edit-profile")}
                accessibilityHint="Edit your name, phone, and skill level"
                isLast={!showChangePassword}
              />

              {showChangePassword ? (
                <AccountGlassRow
                  title="Change password"
                  subtitle="Update your sign-in password"
                  icon={<Lock size={20} color={theme.foreground} weight="regular" />}
                  onPress={() => router.push("/(app)/account/change-password")}
                  accessibilityHint="Opens the change password screen"
                  isLast
                />
              ) : null}
            </AccountGlassSection>
            {!showChangePassword && oauthLabel ? (
              <Text style={scrollStyles.provider}>
                {oauthLabel}
              </Text>
            ) : null}

            <AccountSignOutButton
              label={isSigningOut ? "Signing out…" : "Sign out"}
              disabled={isSigningOut}
              onPress={onSignOutPress}
            />
          </>
        ) : (
          <View style={styles.empty}>
            <Text style={scrollStyles.emptyTitle}>
              Could not load your account.
            </Text>
            <Button
              label="Try again"
              surface="product"
              productTheme={theme}
              onPress={onRetry}
            />
          </View>
        )}
      </SkeletonGate>
    </ScrollView>
  )
}
