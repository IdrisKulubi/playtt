import { useMemo } from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"
import { CheckCircle } from "phosphor-react-native/src/icons/CheckCircle"

import {
  PlayTTColors,
  PlayTTFontFamilies,
  PlayTTSpacing,
} from "@/constants/playtt-tokens"
import { useProductTheme } from "@/hooks/use-product-theme"
import { getInitials } from "@/lib/account-utils"
import type { UserProfile } from "@/lib/user-api"

type AccountProfileHeroProps = {
  profile: UserProfile
  onVerifyPress?: () => void
}

export function AccountProfileHero({
  profile,
  onVerifyPress,
}: AccountProfileHeroProps) {
  const theme = useProductTheme()
  const verified = profile.emailVerified

  const styles = useMemo(
    () =>
      StyleSheet.create({
        content: {
          flexDirection: "row",
          alignItems: "center",
          gap: PlayTTSpacing.md,
          paddingVertical: PlayTTSpacing.lg,
        },
        avatarRing: {
          padding: 3,
          borderRadius: 40,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: theme.border,
          alignSelf: "flex-start",
        },
        avatar: {
          width: 72,
          height: 72,
          borderRadius: 36,
          backgroundColor: theme.elevated,
          alignItems: "center",
          justifyContent: "center",
        },
        avatarText: {
          fontSize: 24,
          fontFamily: PlayTTFontFamilies.semiBold,
          color: theme.foreground,
        },
        identity: {
          flex: 1,
          minWidth: 0,
          gap: 6,
        },
        name: {
          fontSize: 24,
          lineHeight: 29,
          letterSpacing: -0.48,
          fontFamily: PlayTTFontFamilies.semiBold,
          color: theme.foreground,
        },
        email: {
          lineHeight: 20,
          fontSize: 14,
          fontFamily: PlayTTFontFamilies.regular,
          color: theme.muted,
        },
        chipRow: {
          flexDirection: "row",
          alignItems: "center",
          flexWrap: "wrap",
          gap: PlayTTSpacing.xs,
          marginTop: PlayTTSpacing["2xs"],
        },
        verifiedChip: {
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          paddingHorizontal: PlayTTSpacing.sm,
          paddingVertical: PlayTTSpacing["2xs"],
          borderRadius: 999,
          backgroundColor: theme.elevated,
        },
        verifiedText: {
          fontSize: 13,
          fontFamily: PlayTTFontFamilies.medium,
          color: theme.muted,
        },
        verifyButton: {
          paddingHorizontal: PlayTTSpacing.md,
          minHeight: 44,
          justifyContent: "center",
          borderRadius: 999,
          backgroundColor: PlayTTColors.primary,
        },
        verifyLabel: {
          fontSize: 13,
          fontFamily: PlayTTFontFamilies.semiBold,
          color: PlayTTColors.primaryForeground,
        },
      }),
    [theme],
  )

  return (
    <View style={styles.content}>
      <View style={styles.avatarRing}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{getInitials(profile.name)}</Text>
        </View>
      </View>
      <View style={styles.identity}>
        <Text style={styles.name}>{profile.name}</Text>
        <Text style={styles.email}>{profile.email}</Text>
        <View style={styles.chipRow}>
          {verified ? (
            <View style={styles.verifiedChip}>
              <CheckCircle
                size={16}
                color={theme.muted}
                weight="regular"
              />
              <Text style={styles.verifiedText}>Email verified</Text>
            </View>
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Verify email"
              onPress={onVerifyPress}
              style={styles.verifyButton}
            >
              <Text style={styles.verifyLabel}>Verify email</Text>
            </Pressable>
          )}
        </View>
      </View>
    </View>
  )
}
