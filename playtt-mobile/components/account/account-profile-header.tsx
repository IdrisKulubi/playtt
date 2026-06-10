import { useMemo } from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"

import {
  PlayTTColors,
  PlayTTFontFamilies,
  PlayTTSpacing,
  PlayTTTypography,
} from "@/constants/playtt-tokens"
import type { ProductThemeColors } from "@/constants/product-theme"
import { useProductTheme } from "@/hooks/use-product-theme"
import { getInitials } from "@/lib/account-utils"
import type { UserProfile } from "@/lib/user-api"

type AccountProfileHeaderProps = {
  profile: UserProfile
  onVerifyPress?: () => void
}

function createStyles(theme: ProductThemeColors) {
  return StyleSheet.create({
    header: {
      alignItems: "flex-start",
      gap: PlayTTSpacing.xs,
      paddingBottom: PlayTTSpacing.lg,
      marginBottom: PlayTTSpacing.xs,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
    },
    avatar: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: theme.input,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: PlayTTSpacing.xs,
    },
    avatarText: {
      fontSize: 22,
      fontFamily: PlayTTFontFamilies.semiBold,
      color: PlayTTColors.primary,
    },
    name: {
      ...PlayTTTypography.title,
      fontFamily: PlayTTFontFamilies.semiBold,
      color: theme.foreground,
    },
    email: {
      fontSize: 14,
      fontFamily: PlayTTFontFamilies.regular,
      color: theme.muted,
    },
    verified: {
      marginTop: PlayTTSpacing.xs,
      fontSize: 13,
      fontFamily: PlayTTFontFamilies.regular,
      color: theme.muted,
    },
    verifyLink: {
      marginTop: PlayTTSpacing.xs,
      fontSize: 14,
      fontFamily: PlayTTFontFamilies.semiBold,
      color: PlayTTColors.primary,
      textDecorationLine: "underline",
    },
  })
}

export function AccountProfileHeader({
  profile,
  onVerifyPress,
}: AccountProfileHeaderProps) {
  const theme = useProductTheme()
  const styles = useMemo(() => createStyles(theme), [theme])
  const verified = profile.emailVerified

  return (
    <View style={styles.header}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{getInitials(profile.name)}</Text>
      </View>
      <Text style={styles.name}>{profile.name}</Text>
      <Text style={styles.email}>{profile.email}</Text>
      {verified ? (
        <Text style={styles.verified}>Email verified</Text>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Verify email"
          onPress={onVerifyPress}
          hitSlop={8}
        >
          <Text style={styles.verifyLink}>Verify email</Text>
        </Pressable>
      )}
    </View>
  )
}
