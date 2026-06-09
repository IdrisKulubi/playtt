import { Pressable, StyleSheet, Text, View } from "react-native"

import {
  PlayTTColors,
  PlayTTFontFamilies,
  PlayTTRadius,
  PlayTTSpacing,
  PlayTTTypography,
} from "@/constants/playtt-tokens"
import { getInitials } from "@/lib/account-utils"
import type { UserProfile } from "@/lib/user-api"

type AccountProfileHeaderProps = {
  profile: UserProfile
  onVerifyPress?: () => void
}

export function AccountProfileHeader({
  profile,
  onVerifyPress,
}: AccountProfileHeaderProps) {
  const verified = profile.emailVerified

  return (
    <View style={styles.header}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{getInitials(profile.name)}</Text>
      </View>
      <Text style={styles.name}>{profile.name}</Text>
      <Text style={styles.email}>{profile.email}</Text>
      {verified ? (
        <View style={styles.verifiedPill}>
          <Text style={styles.verifiedText}>Verified</Text>
        </View>
      ) : (
        <Pressable
          accessibilityRole="button"
          onPress={onVerifyPress}
          style={styles.verifyPill}
        >
          <Text style={styles.verifyText}>Verify email</Text>
        </Pressable>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  header: {
    alignItems: "flex-start",
    gap: PlayTTSpacing.xs,
    paddingBottom: PlayTTSpacing.lg,
    marginBottom: PlayTTSpacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: PlayTTColors.border,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: PlayTTColors.input,
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
    color: PlayTTColors.foreground,
  },
  email: {
    fontSize: 14,
    fontFamily: PlayTTFontFamilies.regular,
    color: PlayTTColors.mutedText,
  },
  verifiedPill: {
    marginTop: PlayTTSpacing.xs,
    paddingHorizontal: PlayTTSpacing.sm,
    paddingVertical: 4,
    borderRadius: PlayTTRadius.pill,
    backgroundColor: "rgba(0, 255, 102, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(0, 255, 102, 0.35)",
  },
  verifiedText: {
    fontSize: 12,
    fontFamily: PlayTTFontFamilies.semiBold,
    color: PlayTTColors.success,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  verifyPill: {
    marginTop: PlayTTSpacing.xs,
    paddingHorizontal: PlayTTSpacing.sm,
    paddingVertical: 4,
    borderRadius: PlayTTRadius.pill,
    backgroundColor: "rgba(255, 184, 0, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(255, 184, 0, 0.35)",
  },
  verifyText: {
    fontSize: 12,
    fontFamily: PlayTTFontFamilies.semiBold,
    color: PlayTTColors.warning,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
})
